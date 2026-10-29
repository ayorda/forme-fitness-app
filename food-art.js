/* FORME — original, locally rendered SVG food illustrations. No external image service or licensing dependencies. */
(function(root){
'use strict';
const c=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const e=(x,y,rx,ry,fill,extra='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const p=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const line=(d,stroke,width=7)=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rect=(x,y,w,h,fill,r=0,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const bowl=(fill='#e1ebdf')=>e(210,172,103,27,'#202725')+p('M108 172 Q119 252 210 249 Q300 251 312 172Z',fill)+e(210,172,104,27,'#f6f5e9')+e(210,169,89,17,'#e2e9d9');
const seed=(x,y,col='#e4c28b',r=6)=>e(x,y,r,r*.62,col,`transform="rotate(-25 ${x} ${y})"`);
const leaf=(x,y,ang=0,col='#71b75d')=>p(`M${x} ${y} q-38 -42 -54 -12 q18 32 54 12`,col,`transform="rotate(${ang} ${x} ${y})"`);
const plate=(base='#f2efe0')=>e(210,187,130,40,'#101e18',`opacity=".32"`)+e(210,174,125,51,base)+e(210,174,104,36,'#cfd9cd');
const beans=(color,count=15)=>Array.from({length:count},(_,i)=>{const x=143+(i%5)*32+(i%2)*5,y=148+Math.floor(i/5)*16;return seed(x,y,color,6+(i%3))}).join('');
const berry=(x,y,col='#40518a',r=16)=>c(x,y,r,col)+p(`M${x-4} ${y-9} l4 5 5 -5 -2 7 -8 0Z`,'#adb5de');
function art(id){
 switch(id){
 case 'chicken': return plate()+p('M128 163 Q145 125 201 132 Q273 108 295 157 Q282 196 228 202 Q173 211 128 163Z','#e9aa8d')+p('M147 153 Q195 122 259 148','#f7c4ab',`stroke="#f7c4ab" stroke-width="8"`)+leaf(169,218,35);
 case 'turkey': return plate()+p('M135 182 Q119 151 175 127 Q229 106 278 144 Q317 175 268 198 Q198 214 135 182Z','#cf927b')+p('M149 171 Q202 124 266 158','none',`stroke="#e6b29d" stroke-width="12"`)+leaf(161,215,35);
 case 'egg': return plate()+e(210,170,92,54,'#fffdf0')+e(210,171,41,37,'#f0b331')+e(198,158,12,8,'#ffe07c')+seed(134,189,'#b8b48b',3);
 case 'tuna': return plate()+p('M121 170 Q182 126 265 145 Q281 157 282 177 Q243 215 164 197 Q142 191 121 170Z','#afced1')+p('M278 157 L319 142 L306 176 L324 202 L280 185Z','#82b5c0')+c(165,164,5,'#264850')+line('M187 171 Q221 153 258 173','#56898d',4);
 case 'salmon': return plate()+p('M113 173 Q190 106 305 161 L280 207 Q199 220 118 190Z','#f88964')+line('M147 164 Q194 153 276 172','#ffd5b4',6)+line('M145 184 Q202 177 279 191','#ffd5b4',6);
 case 'greek': return e(210,217,99,23,'#172d25')+p('M138 137 L282 137 L265 232 L155 232Z','#e9f4ee')+e(210,139,74,20,'#f9f6e7')+e(206,136,57,12,'#fff')+c(227,132,7,'#eff2e7')+rect(165,174,89,32,'#c7e8bc',8);
 case 'cottage': return bowl()+Array.from({length:18},(_,i)=>{let x=144+i%6*24,y=159+Math.floor(i/6)*10;return c(x,y,7,'#f7fbec',`stroke="#d4dcd0" stroke-width="1"`)}).join('');
 case 'oats': return bowl('#b4d2c0')+beans('#d2ac69',19);
 case 'rice': return bowl()+beans('#f9f2dd',19);
 case 'brownrice': return bowl()+beans('#a7794c',19);
 case 'quinoa': return bowl('#bed8c9')+Array.from({length:40},(_,i)=>{const x=139+(i%8)*20+(i%3)*3,y=154+Math.floor(i/8)*7;return c(x,y,3.1,['#c5a06f','#e4d2a3','#bd8555'][i%3])}).join('');
 case 'bread': return e(210,218,100,22,'#14271e')+p('M136 197 L136 120 Q145 91 172 99 Q209 77 247 100 Q284 101 287 129 L287 210 Q216 224 136 209Z','#a3683b')+p('M148 199 L149 130 Q162 109 182 112 Q213 94 245 111 Q267 110 274 135 L273 199Z','#e9c78c')+seed(186,139,'#a87e46',3)+seed(242,162,'#a87e46',3);
 case 'potato': return e(210,218,102,22,'#17291e')+e(210,158,101,70,'#c99759',`transform="rotate(-15 210 158)"`)+c(171,142,6,'#a87744')+c(241,125,5,'#a87744')+c(229,183,4,'#a87744')+c(269,166,5,'#a87744');
 case 'lentils': return bowl('#c9ddd0')+beans('#af8751',21);
 case 'avocado': return e(210,218,120,24,'#13291d')+e(210,156,82,99,'#264e2d',`transform="rotate(-12 210 156)"`)+e(210,156,61,79,'#a8d66f',`transform="rotate(-12 210 156)"`)+e(210,179,34,38,'#985e34')+e(204,171,10,13,'#ba8355');
 case 'almonds': return e(210,218,110,18,'#15271d')+Array.from({length:10},(_,i)=>{const x=144+(i%5)*32,y=151+Math.floor(i/5)*42;return e(x,y,13,28,'#b57642',`transform="rotate(${i%2?-30:23} ${x} ${y})"`)+line(`M${x-3} ${y-12} Q${x} ${y} ${x+2} ${y+13}`,'#d29a63',2)}).join('');
 case 'walnuts': return e(210,218,110,18,'#18261e')+Array.from({length:7},(_,i)=>{const x=153+(i%4)*38,y=154+Math.floor(i/4)*42;return e(x,y,23,20,'#9d6d43')+line(`M${x-11} ${y} Q${x-5} ${y-14} ${x} ${y} T${x+13} ${y}`,'#d4a678',4)}).join('');
 case 'oliveoil': return e(208,236,76,14,'#172a1f')+rect(177,71,65,159,'#799c49',14)+rect(187,57,45,28,'#c1ca8f',5)+rect(183,108,53,87,'#d4be57',8)+rect(194,45,30,17,'#3b5d36',4)+leaf(266,176,-20,'#749e4b');
 case 'peanutbutter': return e(210,235,98,16,'#172a1e')+rect(146,91,128,143,'#ad7443',18)+rect(137,80,146,29,'#d5dcd3',7)+rect(154,128,112,69,'#f1ddbd',12)+e(211,162,42,20,'#a46c35')+seed(211,162,'#cf9251',10);
 case 'chocolate': return e(210,217,112,17,'#132820')+rect(123,102,175,125,'#4e2e27',9,`transform="rotate(-8 210 165)"`)+Array.from({length:8},(_,i)=>{const x=135+(i%4)*40,y=114+Math.floor(i/4)*55;return rect(x,y,33,47,'#7b4838',4,`transform="rotate(-8 210 165)"`)}).join('');
 case 'banana': return e(210,220,115,17,'#17271e')+p('M111 113 Q180 225 302 117 Q272 213 204 212 Q138 212 111 113Z','#f1c84e')+line('M120 118 Q194 189 290 133','#ffe37f',8)+rect(107,109,12,14,'#6b6541',2);
 case 'apple': return e(210,218,102,18,'#14271d')+p('M210 119 C164 77 109 130 134 192 Q159 242 209 218 Q256 239 280 192 C304 133 252 81 210 119Z','#d9574f')+line('M210 116 L214 88','#694e33',10)+leaf(213,103,-15,'#62a65a')+e(173,145,13,22,'#ef9481');
 case 'orange': return e(210,219,98,17,'#18291e')+c(210,158,76,'#ee9139')+c(210,158,66,'#f9b34e')+Array.from({length:6},(_,i)=>line(`M210 158 L${210+58*Math.cos(i*Math.PI/3)} ${158+58*Math.sin(i*Math.PI/3)}`,'#ffe09e',3)).join('')+c(210,158,13,'#fff2bc')+leaf(221,96,10);
 case 'blueberry': return e(210,220,112,17,'#152821')+[[153,156],[191,130],[236,134],[271,161],[177,191],[225,190],[258,192]].map(([x,y],i)=>berry(x,y,i%2?'#445b97':'#3b4a83',27)).join('');
 case 'strawberry': return e(210,219,94,16,'#16291e')+p('M210 114 Q277 89 280 148 Q279 190 210 225 Q143 192 140 149 Q140 91 210 114Z','#da4b45')+Array.from({length:13},(_,i)=>seed(161+i%5*23,147+Math.floor(i/5)*21,'#f0c37d',3)).join('')+leaf(221,114,-30);
 case 'broccoli': return e(210,223,101,18,'#18291f')+p('M189 158 L231 158 L243 226 L178 226Z','#82ab64')+[[-47,4],[-14,-20],[23,-26],[55,2],[6,15]].map(([x,y],i)=>c(210+x,136+y,39,i%2?'#457f45':'#588f4d')).join('');
 case 'spinach': return e(210,220,101,17,'#15271d')+[-32,0,31].map((x,i)=>p(`M210 220 Q${140+x} 134 ${183+x} 93 Q${246+x} 115 210 220Z`,i%2?'#3d8856':'#55a164',`transform="rotate(${x} 210 220)"`)).join('')+line('M211 213 L211 118','#b2d88b',4);
 case 'carrot': return e(210,225,100,18,'#19271e')+p('M175 123 Q208 110 237 130 L211 237 Z','#ed9552')+line('M181 149 L220 153','#ffcb83',5)+line('M194 179 L213 184','#ffcb83',5)+leaf(207,128,-65,'#5c9b4e')+leaf(209,129,10,'#75aa55');
 case 'tomato': return e(210,223,95,17,'#15291d')+c(210,164,78,'#dc5146')+e(180,142,18,25,'#ee8170')+Array.from({length:5},(_,i)=>p(`M210 103 Q${210+32*Math.cos(i*1.26)} ${106+29*Math.sin(i*1.26)} ${210+42*Math.cos(i*1.26)} ${120+38*Math.sin(i*1.26)} L210 120Z`,'#639952')).join('');
 case 'cucumber': return e(210,223,105,18,'#172a1e')+e(209,158,113,40,'#538a51',`transform="rotate(-14 209 158)"`)+e(260,180,39,39,'#b5cb78')+e(260,180,31,31,'#e8eab8')+Array.from({length:7},(_,i)=>seed(248+i%3*11,165+Math.floor(i/3)*12,'#b6d192',3)).join('');
 default: return plate()+c(210,170,70,'#79a568');
 }
}
const palettes={protein:['#21362d','#29392f'],carbs:['#28322b','#3b4130'],fats:['#30342a','#2b3a2c'],fruit:['#2b362a','#39412a'],veg:['#1d382e','#31452f']};
function render(food){
 const pal=palettes[food.cat]||palettes.veg;
 return `<svg viewBox="0 0 420 270" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role="img" aria-label="Илюстрация на ${String(food.name).replace(/[<>\"]/g,'')}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="food-bg-${food.id}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient></defs><rect width="420" height="270" fill="url(#food-bg-${food.id})"/><circle cx="352" cy="40" r="110" fill="#c3ff5c" opacity=".05"/><circle cx="51" cy="242" r="90" fill="#fff" opacity=".035"/>${art(food.id)}</svg>`;
}
root.FORME_FOOD_ART={render,ids:['chicken','turkey','egg','tuna','salmon','greek','cottage','oats','rice','brownrice','quinoa','bread','potato','lentils','avocado','almonds','walnuts','oliveoil','peanutbutter','chocolate','banana','apple','orange','blueberry','strawberry','broccoli','spinach','carrot','tomato','cucumber']};
})(typeof window!=='undefined'?window:globalThis);