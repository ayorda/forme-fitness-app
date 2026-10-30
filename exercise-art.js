/* Original FORME exercise pose diagrams — drawn as SVG paths; no imported image assets.
   These are schematic demonstrations, not anatomical/medical illustrations. */
(function(root){
'use strict';
const line=(x1,y1,x2,y2,color='#8ed4ef',width=16)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const path=(d,color='#8ed4ef',width=16)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const head=(x,y,r=23)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#f4b789" stroke="#253a4a" stroke-width="3"/>`;
const circ=(x,y,r=7)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#e4c39e"/>`;
const arrow=(d)=>`<path d="${d}" fill="none" stroke="#c3ff5c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 9"/>`;
const person=(parts)=>parts.join('');
const drawings={
  Mountain_Climbers:person([
    `<rect x="65" y="354" width="382" height="9" rx="5" fill="#46625d"/>`,
    path('M208 226 L289 241','#5dc3de',35),head(328,212,21),
    path('M291 245 L322 347 M274 249 L292 349','#80cfdf',15),
    path('M208 238 L126 312 L80 337','#9fc6f4',21),
    path('M208 238 L248 305 L291 350','#9fc6f4',21),
    path('M72 342 L96 342 M282 357 L307 357','#f5f3e4',10),
    arrow('M164 316 C174 290 207 284 223 313'),
    `<text x="255" y="395" fill="#d4efe3" font-size="18" font-family="sans-serif" text-anchor="middle">Редувай коленете</text>`
  ]),
  Hanging_Leg_Raise:person([
    `<rect x="90" y="66" width="327" height="15" rx="5" fill="#859a9b"/>`,
    line(198,76,213,138,'#f4b789',15),line(264,76,244,138,'#f4b789',15),
    head(230,136,24),line(230,163,229,268,'#5dc3de',41),
    path('M228 267 L338 267 L391 267','#9fc6f4',23),
    path('M233 284 L340 284 L388 283','#9fc6f4',20),
    path('M384 269 L399 269 M382 285 L399 285','#f5f3e4',10),
    arrow('M330 358 Q392 336 390 303'),
    `<text x="252" y="408" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Изпънати крака напред</text>`
  ]),
  Spinal_Stretch:person([
    `<rect x="198" y="256" width="120" height="14" rx="4" fill="#729185"/>`,
    line(215,266,215,358,'#729185',9),line(310,267,311,357,'#729185',9),
    path('M226 247 Q239 204 260 174','#5dc3de',36),head(265,152,23),
    path('M240 202 L216 167 L239 138 M274 196 L291 170 L276 137','#f4b789',15),
    path('M237 259 L292 267 L316 344','#9fc6f4',19),
    path('M234 263 L265 297 L256 349','#9fc6f4',20),
    path('M305 349 L335 349 M247 354 L277 354','#f5f3e4',11),
    arrow('M337 186 Q361 221 324 250'),
    `<text x="250" y="406" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Гръб на стол, мек наклон</text>`
  ]),
  Calf_Stretch_Hands_Against_Wall:person([
    `<rect x="407" y="75" width="13" height="295" rx="3" fill="#8da3a4"/>`,
    `<rect x="60" y="357" width="385" height="8" rx="4" fill="#617d6c"/>`,
    path('M242 172 L288 257','#5dc3de',37),head(240,145,23),
    path('M256 190 L352 164 L405 158 M253 205 L346 202 L405 202','#f4b789',14),
    path('M286 256 L331 317 L335 354','#9fc6f4',20),
    path('M285 256 L182 328 L120 353','#9fc6f4',20),
    path('M107 357 L143 357 M324 357 L356 357','#f5f3e4',11),
    arrow('M175 285 Q161 261 175 248'),
    `<text x="255" y="409" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Задната пета на пода</text>`
  ]),
  Kneeling_Forearm_Stretch:person([
    `<rect x="66" y="350" width="378" height="11" rx="5" fill="#537b77"/>`,
    head(277,151,23),path('M266 182 L236 259','#5dc3de',35),
    path('M245 210 L290 311 L258 347','#f4b789',15),
    path('M235 212 L222 316 L191 347','#f4b789',15),
    path('M236 259 L177 307 L176 346','#9fc6f4',21),
    path('M235 257 L253 304 L286 344','#9fc6f4',21),
    path('M180 347 L143 347 M281 347 L310 347','#f5f3e4',9),
    arrow('M350 265 Q371 305 343 329'),
    `<text x="255" y="404" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Пръстите сочат коленете</text>`
  ]),
  Seated_Overhead_Stretch:person([
    `<rect x="65" y="352" width="382" height="10" rx="5" fill="#537b77"/>`,
    path('M236 204 Q259 254 246 299','#5dc3de',38),head(219,171,23),
    path('M239 222 L200 285 L157 343','#f4b789',16),
    path('M244 214 Q280 158 259 100 L239 82','#f4b789',15),
    path('M251 295 L305 332 L338 344','#9fc6f4',21),
    path('M241 295 L192 326 L165 347','#9fc6f4',21),
    path('M166 347 L190 350 M322 348 L347 348','#f5f3e4',12),
    arrow('M303 132 C345 176 342 238 303 265'),
    `<text x="255" y="403" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Наклон на торса настрани</text>`
  ]),
  Standing_Hip_Circles:person([
    `<rect x="79" y="355" width="354" height="8" rx="4" fill="#537b77"/>`,
    head(249,120,24),path('M249 152 L249 258','#5dc3de',43),
    path('M228 188 L201 220 L225 256 M269 188 L300 220 L271 255','#f4b789',15),
    path('M237 274 L219 349 M262 271 L287 349','#9fc6f4',23),
    path('M207 354 L240 354 M273 354 L304 354','#f5f3e4',12),
    arrow('M156 233 C143 282 173 319 220 319 M346 282 C365 238 337 203 289 202'),
    `<text x="253" y="407" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Кръгове с тазобедрената става</text>`
  ]),
  Hip_Circles_prone:person([
    `<rect x="64" y="352" width="384" height="9" rx="4" fill="#537b77"/>`,
    head(322,154,22),path('M299 176 L221 212','#5dc3de',33),
    path('M298 199 L320 298 L325 346 M278 211 L284 301 L273 347','#f4b789',16),
    path('M219 223 L177 297 L180 347','#9fc6f4',22),
    path('M217 226 L151 246 L119 296','#9fc6f4',22),
    path('M168 350 L196 350 M263 350 L294 350','#f5f3e4',10),
    arrow('M91 259 C75 194 134 149 186 173'),
    `<text x="250" y="402" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Коляно в кръг от четири опори</text>`
  ]),
  Arm_Circles:person([
    `<rect x="78" y="353" width="355" height="9" rx="5" fill="#537b77"/>`,
    head(251,116,24),path('M250 150 L250 255','#5dc3de',36),
    path('M228 178 L133 188 M271 178 L368 185','#f4b789',17),
    path('M239 265 L224 348 M262 265 L281 348','#9fc6f4',22),
    path('M207 352 L241 352 M269 352 L301 352','#f5f3e4',10),
    arrow('M117 125 C73 153 74 216 117 248 M389 123 C436 156 433 217 393 246'),
    `<text x="254" y="405" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Малки кръгове с изпънати ръце</text>`
  ]),
  Dynamic_Chest_Stretch:person([
    `<rect x="81" y="356" width="354" height="8" rx="4" fill="#537b77"/>`,
    head(249,115,24),path('M249 151 L249 258','#5dc3de',40),
    path('M226 187 L139 175 L89 163 M272 185 L355 174 L405 163','#f4b789',17),
    path('M238 271 L217 352 M264 271 L288 352','#9fc6f4',22),
    path('M207 354 L240 354 M275 354 L305 354','#f5f3e4',10),
    arrow('M111 115 C162 86 191 100 211 134 M389 113 C345 82 309 102 289 137'),
    `<text x="256" y="407" fill="#d4efe3" font-size="17" text-anchor="middle" font-family="sans-serif">Отвори гърди и върни ръцете</text>`
  ])
};
function url(id){
 const illustration=drawings[id];
 if(!illustration) return null;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="448" viewBox="0 0 512 448" role="img"><title>${id}</title><rect width="512" height="448" fill="#172722"/><rect x="20" y="20" width="472" height="408" rx="26" fill="#223a35" stroke="#3a6252" stroke-width="2"/>${illustration}</svg>`;
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
root.FORME_EXERCISE_ART={url,ids:Object.keys(drawings)};
})(typeof window!=='undefined'?window:globalThis);
