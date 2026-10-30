#!/usr/bin/env python3
"""Compare FORME's 30 foods against the official USDA SR Legacy April 2018 CSV.
This is an audit, not a replacement for the user's dietary label data.
USDA source: https://fdc.nal.usda.gov/download-datasets/
"""
import argparse
import csv
import io
import json
import pathlib
import subprocess
import urllib.request
import zipfile

USDA_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
FIELDS = [
    ("kcal", "1008", 1.0),
    ("protein", "1003", 0.11),
    ("carbs", "1005", 0.11),
    ("fat", "1004", 0.11),
    ("fiber", "1079", 0.11),
]
ROOT = pathlib.Path(__file__).resolve().parent

def read_table(zf, basename):
    matching = [n for n in zf.namelist() if n.lower().split("/")[-1] == basename.lower()]
    if not matching:
        raise RuntimeError("Missing USDA file: " + basename)
    with zf.open(matching[0]) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))

def load_forme_foods():
    js = """global.window={};require('./exercise-art.js');require('./data.js');process.stdout.write(JSON.stringify(window.FORME_DATA.foods));"""
    completed = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(completed.stdout)

def official_values(zf, wanted):
    foods = {}
    for row in read_table(zf, "food.csv"):
        if str(row["fdc_id"]) in wanted:
            foods[str(row["fdc_id"])] = row
    nutrient_index = {row["id"]: row for row in read_table(zf, "nutrient.csv")}
    values = {food_id: {} for food_id in wanted}
    nutrient_ids = {e[1] for e in FIELDS}
    for row in read_table(zf, "food_nutrient.csv"):
        food_id = str(row["fdc_id"])
        if food_id in wanted and row["nutrient_id"] in nutrient_ids:
            try:
                values[food_id][row["nutrient_id"]] = float(row["amount"])
            except (TypeError, ValueError):
                continue
    return foods, values, nutrient_index

def audit(archive, report_path):
    records = load_forme_foods()
    if len(records) != 30:
        raise RuntimeError(f"Expected exactly 30 foods, found {len(records)}")
    ids = [str(food["fdcId"]) for food in records]
    if len(set(ids)) != 30:
        raise RuntimeError("FDC IDs are not unique")
    with zipfile.ZipFile(archive) as zf:
        descriptions, official, nutrient_index = official_values(zf, set(ids))
    rows = ["# FORME — official USDA SR Legacy April 2018 audit", "",
            f"Archive: {USDA_URL}", "",
            "Tolerance: 1 kcal, 0.11 g for the other four nutrients; exact source record and state must be reviewed when a value differs.", "",
            "| FORME food | FDC ID | USDA description | Field | FORME | USDA | Difference | Status |",
            "|---|---:|---|---|---:|---:|---:|---|"]
    matches = mismatches = missing = 0
    for record in records:
        id_ = str(record["fdcId"])
        desc = descriptions.get(id_, {}).get("description", "**missing food ID**").replace("|", "/")
        for field, nutrient_id, tol in FIELDS:
            expected = official.get(id_, {}).get(nutrient_id)
            actual = float(record[field])
            if expected is None:
                missing += 1
                status = "MISSING"
                value = "—"
                diff = "—"
            else:
                delta = actual - expected
                value = f"{expected:g}"
                diff = f"{delta:+.2f}"
                status = "MATCH" if abs(delta) <= tol else "REVIEW"
                if status == "MATCH":
                    matches += 1
                else:
                    mismatches += 1
            rows.append(f"| {record['name']} | {id_} | {desc} | {field} | {actual:g} | {value} | {diff} | {status} |")
    rows.extend(["", f"**Checks:** 150; within tolerance: {matches}; review: {mismatches}; missing: {missing}.",
                 "", "**Important:** A numerical match alone does not establish the correct raw/cooked state. Check descriptions in the report against FORME. Do not mark the audit complete if any discrepancies or mismatched descriptions remain."])
    report_path.write_text("\n".join(rows) + "\n", encoding="utf-8")
    print("USDA description cross-check (FORME state -> official description):")
    for record in records:
        id_ = str(record["fdcId"])
        desc = descriptions.get(id_, {}).get("description", "MISSING FOOD ID")
        print(f"  {record['name']} | {record['state']} | FDC {id_} | {desc}")
    print(f"USDA audit: matches={matches}, review={mismatches}, missing={missing}; report={report_path}")
    return 0 if mismatches == 0 and missing == 0 else 2

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=pathlib.Path, help="Use a previously downloaded official USDA zip archive")
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "USDA-OFFICIAL-AUDIT.md")
    args = parser.parse_args()
    if args.zip:
        archive = args.zip
    else:
        archive = ROOT / "_usda_sr_legacy_2018.zip"
        print("Downloading official USDA archive (about 7 MB)...")
        urllib.request.urlretrieve(USDA_URL, archive)
    return audit(archive, args.report)

if __name__ == "__main__":
    raise SystemExit(main())
