// Small, local SVG stickers. Every catalog entry has an authored visual recipe.
// Solid silhouettes and two-tone facets remain readable at HUD sizes; no filters,
// remote images, generated IDs or per-icon animation are required.
const palettes=Object.freeze({
 sky:['#62a8f4','#315fa9','#d5f5ff','#ffc76b'],
 rose:['#ee83b4','#a54179','#ffe4f2','#9ce6f5'],
 violet:['#aa93ed','#6752a8','#f0e8ff','#ffe198'],
 mint:['#79cfbf','#357f94','#dcfff3','#ffbf9f'],
 gold:['#f4bf63','#b77735','#fff1bd','#9bdcf8'],
 coral:['#f58e7d','#b34e67','#ffe4d2','#b6edf6'],
 ice:['#9bd9eb','#4b82ba','#f1fdff','#d6b0f6'],
 steel:['#a5b5d5','#566d98','#eef5ff','#f3b3d2'],
 indigo:['#8098df','#414f91','#dce8ff','#ffc3da'],
});
const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const rect=(x,y,w,h,fill,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const shell=(d,p)=>path(d,'#172344','opacity=".3" transform="translate(0 2)" stroke="#172344" stroke-width="4" stroke-linejoin="round"')+path(d,p[0],'stroke="#fff4f0" stroke-width="3.2" stroke-linejoin="round"');
const stroke=(d,color,width=2)=>path(d,'none',`stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`);
const motifs={
 lens:p=>shell('M36 31 43 38 38 43 31 36A16 16 0 1 1 36 31Z',p)+circle(22,22,12,p[1])+circle(22,22,9,p[3])+path('M16 18 25 13 27 18 18 26Z',p[2])+path('m35 33 5 5-2 2-5-5Z',p[2]),
 telescope:p=>shell('m5 25 7-15 29 10-8 17Z',p)+path('m17 12-7 16 5 2 7-16Zm17 6-7 17 6 2 8-17Z',p[1])+path('m14 13 18 6-2 4-18-6Z',p[2])+path('m23 29 6 3-3 10h-5Z',p[3]),
 target:p=>shell('M24 4a20 20 0 1 1 0 40 20 20 0 0 1 0-40Z',p)+circle(24,24,15,p[1])+circle(24,24,11,p[2])+circle(24,24,7,p[0])+circle(24,24,3,p[3])+rect(22,7,4,8,p[2],1)+rect(7,22,8,4,p[2],1)+rect(33,22,8,4,p[2],1),
 sunrise:p=>shell('M5 18h8a11 11 0 0 1 22 0h8v23H5Z',p)+circle(24,18,8,p[3])+path('M5 27 15 20l10 8 9-9 9 8v14H5Z',p[1])+path('m14 25 6-1 5 4-6 2Z',p[2])+path('M7 35h34v4H7Z',p[0]),
 mountain:p=>shell('m4 37 11-25 8 13L31 5l13 32-20 7Z',p)+path('M31 5v31l13 1Z',p[1])+path('m15 12-5 12 5-3 5 5Zm16-7-6 15 6-4 5 3Z',p[2])+path('m5 37 14-8 12 7-7 8Z',p[3]),
 rocket:p=>shell('M20 8 36 4l-2 17-9 10-12-12Zm-7 11-8 7 8 4m12 1-4 11-6-9',p)+path('m20 8 7 7 9-11Z',p[2])+circle(25,17,5,p[1])+circle(25,17,2.5,p[3])+path('m12 29-5 12 12-6Z',p[3]),
 crystal:p=>shell('m23 4 16 11 4 17-19 12L5 31l4-16Z',p)+path('m23 4-4 21 5 19 8-23Z',p[2])+path('m39 15-7 6-8 23 19-12Z',p[1])+path('M9 15 19 25 5 31Z',p[3]),
 coil:p=>shell('M24 5c12 0 19 8 19 18S35 42 24 42 5 34 5 23 13 5 24 5Z',p)+circle(24,24,13,p[1])+circle(24,24,9,p[2])+circle(24,24,5,p[3])+stroke('M14 12c19-8 29 18 11 23-13 3-19-12-11-18 7-5 16 4 8 8',p[0],4),
 base:p=>shell('m5 21 19-11 19 11v13L24 44 5 34Z',p)+path('m5 21 19 10 19-10-19-11Z',p[2])+path('m24 31 19-10v13L24 44Z',p[1])+path('m15 18 9-5 10 5-10 6Z',p[3]),
 toolkit:p=>shell('M7 15h9V8h16v7h9v26H7Z',p)+rect(19,11,10,6,p[1],2)+rect(9,20,30,18,p[1],3)+path('M21 21h7v5h5v7h-5v5h-7v-5h-5v-7h5Z',p[2])+rect(9,16,30,4,p[3],1),
 anchor:p=>shell('M20 16a7 7 0 1 1 8 0v13h6l-2-5 11 3c-1 9-9 16-19 17C14 43 6 36 5 27l11-3-2 5h6Z',p)+circle(24,10,3,p[2])+path('M21 20h6v17h-6Z',p[1])+path('m8 29 5 2c2 4 5 6 9 7v3C15 39 10 35 8 29Z',p[2]),
 network:p=>shell('M22 5h6l5 13 11 13-4 9-15-1-15 3-6-9 11-14Z',p)+path('m23 13-9 19 3 2 8-16 9 16 3-2-9-19Z',p[1])+circle(25,11,6,p[3])+circle(11,34,7,p[2])+circle(37,33,7,p[0])+circle(37,33,3,p[2]),
 clock:p=>shell('M17 4h14v6a18 18 0 1 1-14 0Z',p)+circle(24,27,13,p[2])+circle(24,27,10,p[0])+path('M22 15h4v11l8 5-3 4-9-6Z',p[1])+circle(24,27,3,p[3])+rect(19,5,10,5,p[3],1),
 loop:p=>shell('M9 18A17 17 0 0 1 36 9l4-4v16H24l5-5a9 9 0 0 0-14 6Zm30 12A17 17 0 0 1 12 39l-4 4V27h16l-5 5a9 9 0 0 0 14-6Z',p)+path('M11 17c3-8 11-10 19-7l-3 3c-6-1-10 2-12 7ZM17 35l-5 4-1-8h8l-3 3Z',p[2]),
 relay:p=>shell('m8 7 8 4 8-7 8 7 8-4v24l-9 5v7H17v-7l-9-5Z',p)+path('m10 11 14 12 14-12v14L24 33 10 25Z',p[1])+path('m14 12 10 8 10-8-10-5Z',p[2])+rect(21,24,6,16,p[3],2),
 shield:p=>shell('m24 4 18 7-2 17c-2 7-8 12-16 16C16 40 10 35 8 28L6 11Z',p)+path('M24 9v29c7-4 11-8 12-13l2-11Z',p[1])+path('m12 14 12-5v7l-10 4Z',p[2])+path('m18 25 5 5 10-13 4 4-14 15-9-8Z',p[3]),
 bell:p=>shell('M19 8a5 5 0 0 1 10 0c8 2 9 9 9 17l5 9H5l5-9c0-8 1-15 9-17Zm-3 29h16a8 8 0 0 1-16 0Z',p)+path('M24 11c8 1 9 6 9 15l4 5H24Z',p[1])+path('M16 23c0-6 1-9 5-10v7Z',p[2])+rect(8,30,32,4,p[3],1),
 hourglass:p=>shell('M10 5h28v7L29 24l9 12v7H10v-7l9-12-9-12Z',p)+path('m14 12 10 13 10-13Zm1 23h18l-9-10Z',p[2])+path('m19 16 5 7 5-7ZM16 35l8-8 8 8Z',p[3])+rect(12,7,24,4,p[1],1)+rect(12,38,24,3,p[1],1),
 feather:p=>shell('M38 5C21 3 9 14 9 29l-5 12 8 2 7-11C34 31 42 19 38 5Z',p)+path('M36 8 12 38l5-12-4-5 8 1-1-7 8 2Z',p[2])+path('m21 28 13-14c-1 7-5 12-13 14Z',p[1]),
 speaker:p=>shell('M6 15h12L36 5v36L18 31H6Z',p)+path('M22 14 33 9v28l-11-6Z',p[1])+path('M8 18h10v10H8Z',p[2])+path('m38 14 5 3v14l-5 3Z',p[3]),
 battery:p=>shell('M18 4h12v5h9v34H9V9h9Z',p)+rect(13,13,22,26,p[1],3)+path('m26 14-10 14h7l-1 10 11-16h-8Z',p[3])+rect(13,12,20,3,p[2],1),
 filter:p=>shell('M5 7h38v9L29 30v12l-10-5v-7L5 16Z',p)+path('M9 12h30v3L24 29 9 15Z',p[1])+path('M12 11h24v4H12Zm6 8h12v4H18Z',p[2])+path('m23 30 4-2v10l-4-2Z',p[3]),
 flame:p=>shell('M28 3c1 10 10 10 10 20 7 7 4 19-11 21C10 43 3 34 9 22c2 5 5 4 7 2C12 14 25 11 28 3Z',p)+path('M27 15c-1 11 11 13 5 22-6 7-16 2-15-5 0-5 7-6 10-17Z',p[3])+path('M24 29c-4 8-3 10 2 11 5-2 2-6-2-11Z',p[2]),
 book:p=>shell('M5 8c7-3 13-2 19 2 6-4 12-5 19-2v32c-7-3-13-2-19 2-6-4-12-5-19-2Z',p)+path('M8 12c6-2 10 0 14 2v23c-5-3-9-4-14-2Z',p[2])+path('M26 14c5-3 9-4 14-2v23c-5-2-9-1-14 2Z',p[1])+path('M11 18h8v3h-8Zm0 7h8v3h-8Z',p[0])+path('m29 17 7-2v12l-3-2-4 4Z',p[3]),
 chip:p=>shell('M12 9h24v3h7v6h-7v5h7v6h-7v7h-7v7h-6v-7h-5v7h-6v-7H5v-7h7v-5H5v-6h7Z',p)+rect(14,12,20,21,p[1],3)+rect(18,16,12,13,p[2],2)+path('m25 16-6 8h5l-1 5 7-9h-5Z',p[3]),
 cushion:p=>shell('M12 7h24l7 11-3 21-16 5-16-5-3-21Z',p)+path('m12 12 12 5 12-5-3 22-9 5-9-5Z',p[2])+path('m24 17 12-5-3 22-9 5Z',p[1])+path('m19 25 5-4 5 4-5 5Z',p[3]),
 coin:p=>shell('M24 5a19 19 0 1 1 0 38 19 19 0 0 1 0-38Z',p)+circle(24,24,14,p[1])+circle(24,23,11,p[3])+path('m24 12 7 10-7 12-7-12Z',p[0])+path('m12 14 9-6 3 3-10 7Z',p[2]),
 eye:p=>shell('M3 24C14 5 34 5 45 24 34 43 14 43 3 24Z',p)+path('M7 24c10-13 24-13 34 0-10 13-24 13-34 0Z',p[2])+circle(24,24,11,p[1])+circle(24,24,7,p[0])+circle(24,24,3,p[3])+circle(21,20,2,p[2]),
 crown:p=>shell('m4 11 11 8 9-14 9 14 11-8-5 29H9Z',p)+path('m8 17 5 18h22l5-18-10 8-6-12-6 12Z',p[3])+path('m10 35 28 0-1 5H11Z',p[1])+path('m24 22 4 5-4 5-4-5Z',p[0]),
 flag:p=>shell('M9 4h6v3h24l-6 10 6 10H15v16H9Z',p)+path('M15 11h18l-4 6 4 6H15Z',p[1])+path('m21 12 3 4 5 1-4 3-4 0-2-4Z',p[3])+rect(10,6,3,32,p[2],1),
 needle:p=>shell('M34 4c8-1 12 5 7 12L14 43l-9-1 1-8Z',p)+path('m11 34 23-23 3 3-23 23-7 3Z',p[2])+path('m32 9 5-2 3 3-2 5Z',p[1])+path('M11 24c-7-9-3-15 4-14 7 2 3 8 8 11',p[3],'stroke="'+p[3]+'" stroke-width="4" stroke-linecap="round"'),
 cloak:p=>shell('M17 5h14l5 12 7 25H5l7-25Z',p)+path('m17 5 7 12 7-12-2 19 8 15H11l8-15Z',p[1])+path('m17 9 7 10-8 11Z',p[2])+circle(24,18,3,p[3])+path('m11 36 7-3 6 4 8-3 5 5H11Z',p[0]),
 heart:p=>shell('M24 12C13-4-3 11 8 25l16 18 16-18C51 11 35-4 24 12Z',p)+path('M24 16c6-12 17-3 10 7L24 36Z',p[1])+path('M11 15c0-6 7-7 10-2l-3 4c-3-3-4-1-5 2Z',p[2]),
 lamp:p=>shell('M19 5h10l3 7 8 9v4H8v-4l8-9ZM20 25h8v12h9v6H11v-6h9Z',p)+path('m17 15 7-8 7 8 6 7H11Z',p[3])+rect(22,26,4,12,p[1],1)+path('m17 18 6-7 2 4-4 6Z',p[2]),
 scroll:p=>shell('M12 6h23a8 8 0 0 1 8 8v4h-8v17c0 7-5 9-11 9H6v-9h7V14H5v-2a6 6 0 0 1 7-6Z',p)+path('M16 10h17v25H16Z',p[2])+path('M19 16h10v3H19Zm0 7h8v3h-8Z',p[0])+path('M8 37h23c-1 4-5 4-9 4H8Z',p[1])+path('m29 27 5 3-5 10-5-6Z',p[3]),
 stairs:p=>shell('M5 31h10V20h10V9h17v30H5Z',p)+path('M8 32h12V22h12V11h8v8H29v11H19v9H8Z',p[2])+path('M32 19h8v20H19v-9h10V19Z',p[1]),
 furnace:p=>shell('m13 5 22 0 7 10v28H6V15Z',p)+rect(11,17,26,21,p[1],4)+path('M26 19c-1 7 7 9 6 15-2 6-15 6-16-1 0-5 7-8 10-14Z',p[3])+path('m23 29-2 6 6 0Z',p[2])+rect(16,8,16,4,p[2],1),
 bridge:p=>shell('M5 13h8v9h22v-9h8v29h-8V29H13v13H5Z',p)+path('M8 12c6 14 26 14 32 0v8c-10 13-22 13-32 0Z',p[3])+rect(6,28,36,5,p[1],1)+rect(7,16,3,23,p[2],1)+rect(37,16,3,23,p[2],1),
 snow:p=>shell('m21 4 6 0 1 9 7-5 4 5-7 7 11 1v6l-11 1 7 7-4 5-7-5-1 9h-6l-1-9-7 5-4-5 7-7-11-1v-6l11-1-7-7 4-5 7 5Z',p)+path('m24 12 6 8 8 4-8 4-6 9-6-9-8-4 8-4Z',p[2])+path('m24 18 6 6-6 6-6-6Z',p[3]),
 lifebuoy:p=>shell('M24 4a20 20 0 1 1 0 40 20 20 0 0 1 0-40Z',p)+circle(24,24,11,p[1])+circle(24,24,7,'#223052')+path('m11 9 8 8-5 6-9-5Zm26 0-8 8 5 6 9-5ZM5 31l9-5 5 6-8 8Zm38 0-9-5-5 6 8 8Z',p[2])+circle(24,24,4,p[3]),
 scale:p=>shell('M21 4h6v8h14v5H27v19h10v7H11v-7h10V17H7v-5h14Z',p)+path('M9 17 3 30h17L14 17Zm25 0-6 13h17l-6-13Z',p[3])+path('m5 29 5 6 9-6Zm24 0 6 6 9-6Z',p[1])+rect(22,8,3,29,p[2],1),
 music:p=>shell('m18 9 24-5v27c0 9-17 12-17 3 0-5 5-8 11-7V15l-12 3v19C24 46 6 47 6 38c0-5 5-8 12-7Z',p)+path('m22 11 16-4v5l-16 4Z',p[2])+path('M9 38c1-3 7-4 10-3-1 5-8 6-10 3Zm20-4c1-3 6-4 10-3-1 5-8 6-10 3Z',p[3]),
 chair:p=>shell('M13 5h22v21h6v11h-6v7h-6v-7H17v7h-6v-7H6V26h7Z',p)+rect(17,9,14,15,p[2],4)+rect(11,28,25,6,p[3],2)+path('M29 9h2v15h-6Z',p[1]),
 home:p=>shell('M3 22 24 4l21 18h-6v21H9V22Z',p)+path('m24 7 17 15h-6v18H24Z',p[1])+rect(19,26,10,17,p[3],3)+rect(12,21,8,7,p[2],2)+rect(29,21,6,7,p[2],2),
 cart:p=>shell('M4 8h7l4 23h25v7H12L6 14H4Zm13 2h22l5 17H16Z',p)+rect(20,13,8,11,p[2],1)+rect(30,13,8,11,p[3],1)+circle(17,41,4,p[1])+circle(36,41,4,p[1]),
 potion:p=>shell('M16 4h16v7h-3v7l10 9v11c0 7-30 7-30 0V27l10-9v-7h-3Z',p)+path('M13 29c8 3 14-3 22 0v8c0 4-22 4-22 0Z',p[1])+path('M19 22h4l-7 9v5h-3v-8Z',p[2])+rect(17,6,14,4,p[3],1),
 syringe:p=>shell('m31 4 13 13-5 5-4-4-15 18-7 1-8 8-3-3 8-8 1-7 18-15-4-4Z',p)+path('m13 27 15-13 6 6-13 15Z',p[2])+path('m16 27 6 6 8-10-4-4Z',p[3])+path('m30 9 9 9 2-2-9-9Z',p[1]),
 bomb:p=>shell('M26 4h11v6h-6v5a15 15 0 1 1-13 0V8h8Z',p)+circle(23,30,11,p[1])+path('m24 21-8 11h6l-2 9 11-14h-7Z',p[3])+path('m37 4 3-3 2 5 5 1-4 4 1 5-5-2-4 2 1-5-4-4Z',p[2]),
 armor:p=>shell('M16 5h16l4 9 8 7-5 22H9L4 21l8-7Z',p)+path('m24 9 8 4 7 10-4 16H24Z',p[1])+path('M13 20h22v6H13Zm2 10h18v5H15Z',p[2])+path('m20 14 4-4 4 4-4 7Z',p[3]),
 sword:p=>shell('m30 4 13 1 1 13-20 17-6-6-8 15-6-6 14-10-6-6Z',p)+path('m31 8 7 1-17 19-4-4Z',p[2])+path('m38 9 2 7-17 15-2-3Z',p[1])+path('m11 25 12 12 5-5-12-12Z',p[3]),
 map:p=>shell('m4 9 13-5 14 5 13-5v35l-13 5-14-5-13 5Z',p)+path('m17 8 14 5v27l-14-5Z',p[1])+path('m8 13 6-3v26l-6 3Zm26 1 6-3v24l-6 3Z',p[2])+path('m17 23 7-7 6 7-6 10Z',p[3]),
 gear:p=>shell('m19 4 10 0 2 6 6-2 7 8-4 5 4 5-3 10-7-1-3 8H19l-3-8-7 1-4-10 4-5-4-5 7-8 6 2Z',p)+circle(24,24,12,p[1])+circle(24,24,7,p[2])+circle(24,24,3,p[3]),
 chest:p=>shell('M6 18 10 6h28l4 12v24H6Z',p)+path('M10 10h28l2 9H8Z',p[2])+path('M8 24h32v15H8Z',p[1])+rect(20,18,9,17,p[3],2)+circle(24.5,25,2,p[1]),
 tent:p=>shell('m24 4 21 38H3Z',p)+path('M24 11v28h17Z',p[1])+path('m24 23-9 16h18Z',p[2])+path('m24 23 9 16h-9Z',p[3]),
 play:p=>shell('M13 5 43 24 13 43Z',p)+path('m17 12 20 12-20 12Z',p[2])+path('m17 24 20 0-20 12Z',p[1]),
 pause:p=>shell('M8 6h12v36H8Zm20 0h12v36H28Z',p)+rect(11,10,5,26,p[2],1)+rect(31,10,5,26,p[2],1),
 close:p=>shell('m11 5 13 13L37 5l7 7-13 12 13 13-7 7-13-13-13 13-7-7 13-13L4 12Z',p)+path('m10 10 3-1 25 25-2 4Z',p[2]),
 check:p=>shell('m4 24 9-8 9 10L38 5l7 7-23 31Z',p)+path('m11 23 3-2 9 10 16-19 2 2-18 23Z',p[2]),
 arrow:p=>shell('M4 17h23V5l18 19-18 19V31H4Z',p)+path('M8 21h23V15l9 9H8Z',p[2])+path('M8 26h23v8l9-10H8Z',p[1]),
 lock:p=>shell('M11 19v-6a13 13 0 0 1 26 0v6h5v24H6V19Z',p)+path('M17 19h14v-6a7 7 0 0 0-14 0Z',p[1])+rect(11,23,26,15,p[3],3)+circle(24,29,4,p[1])+rect(22,30,4,7,p[1],1),
 up:p=>shell('M5 26 24 5l19 21H30v17H18V26Z',p)+path('m24 11-13 12h11v15h5V23h10Z',p[2]),
 down:p=>shell('M5 22 24 43l19-21H30V5H18v17Z',p)+path('m24 37-13-12h11V10h5v15h10Z',p[2]),
 ramp:p=>shell('M4 40 42 6v34Z',p)+path('m10 35 28-24v24Z',p[2])+path('M12 35h26v5H6Z',p[1]),
 flatten:p=>shell('M5 8h38v8H5Zm0 24h38v8H5Zm14-12h10v8H19Z',p)+rect(8,9,32,3,p[2],1)+rect(8,33,32,3,p[2],1),
 undo:p=>shell('M4 21 20 5v10h9c18 0 22 27 2 29h-7v-9h7c8-1 7-11-1-11H20v10Z',p)+path('m10 21 7-7v5h12c12 0 13 15 3 19v-4c6-4 3-11-3-11H17v4Z',p[2]),
 info:p=>shell('M24 4a20 20 0 1 1 0 40 20 20 0 0 1 0-40Z',p)+circle(24,14,4,p[2])+path('M19 22h9v13h4v4H17v-4h4v-9h-2Z',p[2]),
 burst:p=>shell('m24 3 5 12 12-8-5 14 9 5-13 5 6 12-14-8-8 10-2-14-12 2 8-10L3 11l14 5Z',p)+path('m24 13 4 10 8 3-11 4-6 9-2-13-7-6 12 2Z',p[2])+circle(24,26,4,p[3]),
 range:p=>shell('M6 6h36v36H6Z',p)+rect(11,11,26,26,p[1],4)+circle(24,24,10,p[2])+circle(24,24,6,p[0])+path('M21 7h6v10h-6Zm0 24h6v10h-6ZM7 21h10v6H7Zm24 0h10v6H31Z',p[3]),
 question:p=>shell('m24 4 20 20-20 20L4 24Z',p)+path('M15 18c0-10 20-11 20 1 0 6-9 6-9 13h-6c0-9 8-9 8-13 0-4-7-4-7 0Z',p[2])+circle(23,37,3,p[3]),
 bolt:p=>shell('m27 3-20 25h14l-3 17 23-29H27Z',p)+path('m27 9-12 15h12l-4 12 12-16H24Z',p[2]),
 shard:p=>shell('m25 3 15 18-11 23L7 29Z',p)+path('m25 3-2 25 6 16 11-23Z',p[1])+path('m11 27 12 1 2-19Z',p[2])+path('m23 28 13-6-7 17Z',p[3]),
 bandage:p=>shell('m7 15 8-8 27 27-8 8L7 15Z',p)+path('m15 7 27 27-7 7L8 14Z',p[2])+rect(18,18,13,13,p[0],3)+circle(21,22,1.5,p[1])+circle(27,22,1.5,p[1])+circle(21,28,1.5,p[1])+circle(27,28,1.5,p[1]),
 wrench:p=>shell('M25 5c8-3 17 2 18 9l-9-2-5 6 2 6 10 1c-4 8-12 10-18 6L12 44 4 36 18 24C14 17 17 9 25 5Z',p)+path('m8 36 14-13 4 4-14 13Z',p[2])+circle(12,36,2,p[1]),
 wings:p=>shell('M24 17C17 8 12 5 3 5l4 19 13 16h8l13-16 4-19c-9 0-14 3-21 12Z',p)+path('m8 11 12 11 2 13L11 22Zm32 0L28 22l-2 13 11-13Z',p[2])+path('m24 13 6 11-6 16-6-16Z',p[3]),
 crownshield:p=>shell('m7 8 9 6 8-10 8 10 9-6-2 24-15 12L9 32Z',p)+path('m24 18 11-5-1 17-10 9Z',p[1])+path('m15 23 6 5 12-10-2 7-10 10-9-9Z',p[3]),
 handshake:p=>shell('m3 22 10-12 10 5 12-4 10 12-10 16-11-3-10 3Z',p)+path('m14 15 10 4 9-4 7 9-9 10-7-4-8 4-8-10Z',p[2])+path('m24 19-7 9 5 3 8-8 6 3-5 8-7-4-8 4-3-5Z',p[3]),
 three:p=>shell('m24 3 9 14 13 2-9 12 1 13-14-6-14 6 1-13L2 19l13-2Z',p)+circle(24,13,6,p[2])+circle(13,30,6,p[3])+circle(35,30,6,p[1])+path('m22 20 4 0 5 8-4 3-6-7-4 7-4-3Z',p[0]),
 layers:p=>shell('m3 12 21-9 21 9v23l-21 10L3 35Z',p)+path('m5 13 19 8 19-8v8l-19 8-19-8Z',p[2])+path('m5 25 19 8 19-8v8l-19 9-19-9Z',p[1])+path('m24 8 10 4-10 4-10-4Z',p[3]),
 gate:p=>shell('M5 5h38v39H31V17H17v27H5Z',p)+path('M9 9h30v6H9Zm0 8h5v23H9Zm25 0h5v23h-5Z',p[2])+path('m21 22 6 0 0 8 7 0-10 11-10-11h7Z',p[3]),
 wave:p=>shell('M4 29C8 8 26 3 39 11c-8 0-12 9-4 14l9 6v12H4Z',p)+path('M8 31c8-13 21-13 29 0H8Z',p[2])+path('M7 34h33v6H7Z',p[1])+path('M15 19c6-7 14-8 19-6-7 2-9 6-9 11Z',p[3]),
 basket:p=>shell('M11 18 18 5h12l7 13h7l-5 25H9L4 18Z',p)+path('m17 18 5-9h4l5 9Z',p[1])+rect(10,22,28,15,p[2],3)+rect(14,24,5,11,p[0],1)+rect(22,24,5,11,p[0],1)+rect(30,24,5,11,p[0],1),
 swordpair:p=>shell('m5 5 11 1 8 14 8-14 11-1-1 12-14 10 13 12-6 6-11-14L12 45l-6-6 13-12L6 17Z',p)+path('m8 8 12 15 4-3L13 9Zm32 0L28 23l-4-3L35 9Z',p[2])+path('m10 32 6-6 19 14-3 4Zm22-6 6 6-19 12-3-4Z',p[3]),
 grid:p=>shell('M5 5h38v38H5Z',p)+rect(10,10,11,11,p[2],2)+rect(27,10,11,11,p[3],2)+rect(10,27,11,11,p[3],2)+rect(27,27,11,11,p[1],2),
 compass:p=>shell('M24 3 29 9l11-1-1 11 6 5-6 5 1 11-11-1-5 6-5-6-11 1 1-11-6-5 6-5L8 8l11 1Z',p)+circle(24,24,13,p[2])+path('m30 14-3 13-13 7 7-13Z',p[1])+path('m30 14-9 7 6 6Z',p[3]),
 gemheart:p=>shell('m7 8 10-4 7 9 7-9 10 4 3 14-20 22L4 22Z',p)+path('m24 13 7-9 10 4-11 19-6 17Z',p[1])+path('m7 8 14 10 3 26L4 22Z',p[2])+path('m21 18 9 9-6 13Z',p[3]),
 shieldwall:p=>shell('M4 8h11v7h7V8h11v7h11v28H4Z',p)+path('M8 21h32v18H8Z',p[1])+path('M10 23h10v5H10Zm16 0h12v5H26Zm-9 10h13v5H17Z',p[2])+path('m24 16 7 4-2 11-5 4-5-4-2-11Z',p[3]),
 diamond:p=>shell('m24 3 21 21-21 21L3 24Z',p)+path('M24 8v32L8 24Z',p[2])+path('m24 8 16 16-16 16 7-16Z',p[1])+circle(24,24,5,p[3]),
 heartpulse:p=>motifs.heart(p)+path('M9 23h8l4-9 5 16 3-7h10v5h-7l-6 10-6-15-2 5H9Z',p[3]),
 head:p=>shell('M25 4c12 0 19 12 15 22l-8 7v10H17v-9H9v-9l-5-3 5-8c2-7 8-10 16-10Z',p)+path('M25 9c9 0 13 10 8 17l-5 3V15Z',p[1])+path('m20 12 10 10-7 10-9-10Z',p[2])+circle(22,22,4,p[3]),
 plug:p=>shell('M14 4h6v10h8V4h6v10h7v11l-11 9v10H18V34L7 25V14h7Z',p)+path('M11 18h26v5L24 33 11 23Z',p[1])+rect(13,18,21,5,p[2],1)+path('m24 21-6 8h6l-1 8 9-12h-7Z',p[3]),
 archive:p=>shell('M7 5h34v38H7Z',p)+rect(11,9,26,9,p[2],2)+rect(11,22,26,16,p[1],2)+rect(20,12,9,3,p[0],1)+rect(20,25,9,3,p[3],1)+path('m17 31 7-4 7 4-7 5Z',p[0]),
 wrenchgear:p=>motifs.gear(p)+path('m25 11 4 4-14 19-5-5Z',p[3],'stroke="#fff4f0" stroke-width="1.5"'),
 star:p=>shell('m24 3 6 14 15 2-11 11 3 15-13-7-13 7 3-15L3 19l15-2Z',p)+path('m24 9 4 12 11 1-11 4-4 14-4-14-11-4 11-1Z',p[2]),
 helmet:p=>shell('M6 25C6 1 42 1 42 25v14l-10 5V31H16v13L6 39Z',p)+path('M24 8c9 0 14 6 14 17H24Z',p[1])+path('m10 25 28 0v5H10Z',p[3])+path('M13 21c0-8 4-11 8-12v6c-3 2-4 4-4 6Z',p[2]),
 arrows:p=>shell('M4 11h25V4l15 14-15 14v-8H4Zm15 21h25v10H19v6L4 35l15-14Z',p)+path('M7 14h26V12l6 6H7Z',p[2])+path('M11 35h29v4H15v2Z',p[3]),
 speech:p=>shell('M6 6h36v27H23L11 44V33H6Z',p)+rect(10,11,28,17,p[2],3)+circle(16,19,2,p[1])+circle(24,19,2,p[1])+circle(32,19,2,p[1]),
 seed:p=>shell('M25 43C7 34 3 18 10 8c5-4 10-1 14 5 4-8 10-11 16-6 7 11-1 27-15 36Z',p)+path('M25 38C20 26 26 17 36 10c4 9-1 20-11 28Z',p[1])+path('M13 12c-5 7 0 17 8 23l-3-17Z',p[2]),
 shop:p=>shell('M7 6h34l4 13-5 6v19H8V25l-5-6Z',p)+path('m11 9-3 9h31l-3-9Z',p[2])+rect(13,25,22,14,p[1],2)+rect(22,27,9,16,p[3],1)+rect(15,28,5,6,p[2],1),
 archiveflame:p=>motifs.archive(p)+path('M32 21c0 6 8 7 7 14-1 7-13 9-15 2-1-5 5-7 8-16Z',p[3],'stroke="#fff4f0" stroke-width="1.5"'),
 starclock:p=>motifs.clock(p)+path('m37 1 2 6 7 1-5 4 1 7-5-4-6 4 2-7-5-4 7-1Z',p[3],'stroke="#fff4f0" stroke-width="1.5"'),
 echo:p=>motifs.bell(p)+path('M38 11c8 8 8 16 0 24l-3-4c5-5 5-11 0-16Z',p[3]),
 fusebox:p=>motifs.chip(p)+path('M18 17h12v13H18Z',p[3])+path('m25 17-6 8h5l-1 6 7-10h-5Z',p[1]),
 ruler:p=>shell('m7 4 17 0 17 40H24Z',p)+path('m11 8 10 0 13 32h-7Z',p[2])+path('m18 13 6-2 2 5-6 2Zm4 10 6-2 2 5-6 2Zm4 10 6-2 2 5-6 2Z',p[1]),
};

const badgePaths={
 spark:'m7 0 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z',
 up:'M7 0 14 7h-4v7H4V7H0Z',
 down:'M4 0h6v7h4l-7 7-7-7h4Z',
 arrow:'M0 4h7V0l7 7-7 7v-4H0Z',
 bolt:'M8 0 1 8h5l-1 6 8-10H8Z',
 plus:'M4 0h6v4h4v6h-4v4H4v-4H0V4h4Z',
 check:'m0 7 3-3 3 4 6-8 3 3-9 11Z',
 wing:'M14 0C3 0 0 5 1 11l-1 3 4-1C12 11 14 5 14 0Z',
 shield:'M7 0 14 3l-1 6-6 5-6-5-1-6Z',
 twin:'M0 0h6v12H0Zm8 2h6v12H8Z',
 link:'M3 0h6l4 5-4 4H7V6h1l2-1-2-2H5L3 6l2 2v3L0 6Zm8 4 4 5-5 5H4L1 9l3-1 2 3h3l3-2-2-2Z',
 sun:'m5 0 4 0 0 3 3-2 2 3-3 2h3v4h-3l2 2-3 2-2-3v3H5v-3l-3 2-2-3 3-2H0V5h3L1 2l3-2 1 3Z',
 snow:'M5 0h4v4l3-2 2 3-4 2 4 2-2 3-3-2v4H5v-4l-3 2-2-3 4-2-4-2 2-3 3 2Z',
 wave:'M0 4C5-4 8 8 14 1v5C8 13 5 1 0 9Zm0 7c5-6 8 6 14-1v4H0Z',
 gear:'M5 0h4l1 3 3-1 2 4-3 2 1 4-4 2-2-3-4 1-2-4 3-2-1-3Z',
 coin:'M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0Z',
 heart:'M7 3C2-4-3 4 1 8l6 6 6-6c4-4-1-12-6-5Z',
 crown:'m0 2 4 3 3-5 3 5 4-3-2 12H2Z',
 flag:'M1 0h3v2h10l-3 4 3 4H4v4H1Z',
 leaf:'M13 0C2 0-1 4 2 11l-2 3 4-1C12 15 16 6 13 0Z',
 target:'M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
 eye:'M0 7C4 0 10 0 14 7 10 14 4 14 0 7Zm7-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
 burst:'m7 0 2 4 5-2-2 5 3 3-5-1-3 6-2-6-5 1 3-3-2-5 4 2Z',
 loop:'M1 5C3-1 10-1 13 3l2-2v7H8l2-2C8 2 4 3 3 7Zm12 4c-2 7-10 7-13 2l-1 2V6h7L4 9c2 4 5 3 7-1Z',
 layers:'m0 3 7-3 7 3-7 4Zm0 4 7 3 7-3v4l-7 3-7-3Z',
 clock:'M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0Zm-1 2v6l5 2 1-3-3-1V2Z',
 music:'M6 2 14 0v9c0 5-7 6-7 2 0-2 2-3 4-3V4L8 5v7c-2 4-8 3-8 0 0-2 3-3 6-2Z',
 star:'m7 0 2 4 5 1-4 3 1 6-4-3-4 3 1-6-4-3 5-1Z',
 seed:'M7 14C0 9-2 3 3 1l4 3 4-4c6 3 2 10-4 14Z',
 sword:'m10 0 4 0v4l-7 7-2-2-3 5-2-2 5-3-2-2Z',
 book:'M0 1c3-1 5 0 7 2 2-2 4-3 7-2v12c-3-1-5 0-7 1-2-1-4-2-7-1Z',
 flame:'M8 0c0 5 5 6 5 9 0 8-13 7-13 1C0 6 6 4 8 0Z',
 armor:'M4 0h6l1 3 3 3-2 8H2L0 6l3-3Z',
 mountain:'m0 14 4-9 3 4 3-9 5 14Z',
 bell:'M4 2c0-3 6-3 6 0 3 1 2 4 3 7l2 2H0l2-2c1-3 0-6 2-7Zm1 11h5v2H5Z',
 key:'M4 0a4 4 0 1 1 2 8l8 4-2 3-4-2-2 1-2-3-1-3a4 4 0 0 1 1-8Z',
};

function recipes(source){return Object.freeze(Object.fromEntries(Object.entries(source).map(([id,value])=>{
 const [motif,palette,badge]=value.split(' ');return[id,Object.freeze({motif,palette,badge:badge||null})];
})));}
export const CONTENT_STICKERS=Object.freeze({
 relics:recipes({
  elevated_lens:'lens sky up',clear_horizon:'sunrise ice spark',skyhook_rounds:'rocket gold wing',calibrated_scope:'target steel check',overlook_protocol:'eye indigo down',
  impact_lattice:'grid coral burst',return_current:'coil sky loop',cheap_relocation:'base mint arrow',repair_reserve:'toolkit mint plus',lasting_anchor:'anchor steel shield',
  mesh_network:'network sky link',shared_clock:'clock violet twin',maintenance_loop:'loop mint plus',redundant_relay:'relay gold twin',local_shield:'shield violet heart',
  distant_silence:'bell ice wave',resistance_prism:'crystal violet shield',slow_decay:'hourglass mint wave',clean_kill:'feather ice spark',pulse_absorber:'cushion sky bolt',
  redline_amplifier:'speaker coral bolt',crisis_focus:'battery coral target',pain_filter:'filter rose heart',final_resolve:'flame coral shield',volatile_clarity:'bomb gold star',
  wide_channel:'plug sky plus',compact_encoding:'chip indigo layers',overload_buffer:'cushion rose shield',signal_dividend:'coin gold wave',relay_efficiency:'relay mint bolt',
  nexus_horizon:'eye sky spark',nexus_lens:'telescope ice target',nexus_terraces:'base violet up',nexus_watchline:'compass sky eye',nexus_floating_stairs:'stairs ice wing',nexus_target_notes:'book steel target',
  nexus_bastion:'shieldwall steel flag',nexus_thorns:'crown coral bolt',nexus_sentinel:'helmet gold eye',nexus_shared_burden:'handshake mint shield',nexus_rebuke:'sword indigo burst',nexus_watch_rotation:'flag gold clock',
  nexus_second_skin:'shield mint leaf',nexus_stitch:'needle rose heart',nexus_aftercare:'toolkit coral sun',nexus_patchwork:'cloak rose plus',nexus_calm_pulse:'heartpulse mint wave',nexus_suture:'syringe ice plus',
  nexus_credit:'lamp gold clock',nexus_blueprint:'scroll sky gear',nexus_small_voices:'speech violet music',nexus_portable_archive:'archive indigo wing',nexus_study_credit:'book gold star',nexus_thrifty:'book steel coin',
  nexus_crown:'mountain gold crown',nexus_skyfire:'furnace coral wing',nexus_airlock:'gate indigo wing',nexus_crossfire:'mountain sky twin',nexus_survey_wings:'wings ice target',nexus_moving_terrace:'base violet arrow',
  nexus_choir:'music violet link',nexus_clock:'starclock gold music',nexus_open_channel:'relay sky music',nexus_harmonic_bridge:'bridge rose wave',nexus_auxiliary_bus:'plug violet plus',nexus_resonant_workshop:'wrenchgear mint music',
  nexus_stillness:'gate ice snow',nexus_silence:'bell ice snow',nexus_distance:'ruler ice flag',nexus_quiet_margin:'shield ice snow',nexus_distant_snow:'flag sky snow',nexus_slow_echo:'echo violet snow',
  nexus_red_tide:'gemheart coral wave',nexus_lifeline:'lifebuoy rose shield',nexus_sacrifice:'coin indigo heart',nexus_deep_reserve:'archive sky wave',nexus_survival_pulse:'heartpulse coral bolt',nexus_return_tide:'wave mint plus',
  nexus_verdict:'scale steel bolt',nexus_precision:'target indigo eye',nexus_quiet_end:'music steel shield',nexus_decree_breaker:'target coral burst',nexus_last_measure:'ruler gold eye',nexus_signal_dam:'shieldwall indigo wave',
  nexus_ensemble:'three coral music',nexus_few:'chair violet star',nexus_many:'speech sky twin',nexus_open_ensemble:'music rose wing',nexus_soloist:'chair gold music',nexus_first_notes:'music gold seed',
  nexus_legacy:'archiveflame coral book',nexus_reserve:'plug ice shield',nexus_home:'home mint heart',nexus_last_blueprint:'scroll gold gear',nexus_unspent_signal:'wave violet shield',nexus_archive_cart:'cart steel book',
  nexus_last_stand:'sword coral sun',nexus_rebirth:'seed gold flame',nexus_final_charge:'battery gold bolt',nexus_daybreak_guard:'shieldwall gold sun',nexus_ember_return:'flame rose loop',nexus_dawn_overclock:'clock coral bolt',
 }),
 talents:recipes({
  height_mastery:'mountain violet up',target_solution:'chip sky target',clear_line:'telescope sky arrow',mortar_math:'rocket coral target',
  unbroken_line:'shieldwall violet heart',counter_rhythm:'loop coral sword',hardened_footing:'base steel shield',field_patch:'bandage mint plus',
  linked_support:'network mint link',triage_logic:'toolkit sky eye',shield_memory:'shield sky book',distributed_clock:'clock mint plus',
  distance_doctrine:'ruler violet arrow',resistance_memory:'archive violet shield',early_warning:'bell gold eye',soft_impact:'cushion ice burst',
  crisis_accuracy:'target rose heart',calm_aftershock:'wave rose plus',risk_conversion:'coin coral heart',wakeful_rage:'gemheart rose bolt',
  expanded_bus:'plug gold plus',graceful_overload:'fusebox violet shield',priority_channel:'relay indigo star',relay_feedback:'loop gold bolt',
 }),
 items:recipes({clarity:'potion mint heart',repair_foam:'potion coral plus',focus_cell:'battery gold spark',stasis:'potion ice snow',overclock:'syringe coral bolt',barrier:'potion violet shield',insulator:'potion gold shield',pulse_bomb:'bomb rose burst',cleanser:'potion sky wave',fortify:'potion steel armor'}),
 messengers:recipes({far_watcher:'telescope sky star',oath_keeper:'shield steel flag',seed_healer:'seed mint plus',archive_child:'book violet star',crystal_cartographer:'compass ice mountain',chorus_weaver:'music rose link',winter_listener:'snow ice bell',pulse_diver:'lifebuoy indigo wave',star_judge:'scale gold star',foreign_voice:'speech coral music',gate_archivist:'archive steel key',scarred_dawn:'flame gold shield'}),
});

export const UI_STICKERS=recipes({
 heart:'heart rose',repair:'toolkit mint',snow:'snow ice',attack:'bolt coral',resistance:'shield violet',burst:'burst coral',armor:'armor steel',
 battle:'swordpair coral',elite:'crown gold',boss:'crownshield rose',camp:'tent gold',workshop:'wrench steel',shop:'shop gold',treasure:'chest gold',event:'diamond violet',unknown:'question violet',
 spirit:'gemheart rose',focus:'bolt gold',bandwidth:'plug sky',depth:'layers violet',map:'map ice',settings:'gear steel',book:'book sky',
 play:'play mint',pause:'pause gold',close:'close coral',check:'check mint',arrow:'arrow sky',lock:'lock steel',shield:'shield sky',ranged:'telescope sky',melee:'sword coral',support:'toolkit mint',
 undo:'undo violet',raise:'up sky',lower:'down rose',ramp:'ramp gold',flatten:'flatten ice',sound:'speaker violet',
 info:'info sky',range:'range ice',warning:'question coral',tutorial:'book violet star',gift:'chest rose',talent:'head violet',relic:'crystal gold',fragments:'shard rose',fragment:'shard rose',
 inventory:'basket steel',capacity:'basket sky',upgrade:'stairs violet up',move:'compass ice',speed:'arrows sky',time:'clock gold',xp:'star violet',fullscreen:'range steel',save:'archive sky',refresh:'loop mint',
});

const className=value=>String(value||'').replace(/[^A-Za-z0-9_\s-]/g,'').trim();
const rendered=new Map();
function art(recipe){
 const signature=`${recipe.motif}:${recipe.palette}:${recipe.badge||''}`;
 if(rendered.has(signature))return rendered.get(signature);
 const palette=palettes[recipe.palette],body=motifs[recipe.motif](palette);
 const badge=recipe.badge?`<g class="sticker-badge" transform="translate(33 31) scale(.82)">${path(badgePaths[recipe.badge],'#152447','opacity=".3" transform="translate(0 2)" stroke="#152447" stroke-width="3" stroke-linejoin="round"')}${path(badgePaths[recipe.badge],palette[3],'stroke="#fff4f0" stroke-width="2.6" stroke-linejoin="round" fill-rule="evenodd"')}${circle(5,4,1.2,palette[2])}</g>`:'';
 const value=`<g class="sticker-object">${body}</g>${badge}`;rendered.set(signature,value);return value;
}
function svg(recipe,key,cls){return `<svg class="icon sticker-icon ${className(cls)}" viewBox="0 0 48 48" fill="none" stroke="none" data-sticker-key="${key}" aria-hidden="true" focusable="false">${art(recipe)}</svg>`;}
/** Existing compact UI glyph API, with a filled fallback for unknown names. */
export function stickerIcon(name,cls=''){
 const key=Object.hasOwn(UI_STICKERS,name)?name:'unknown';return svg(UI_STICKERS[key],`ui:${key}`,cls);
}
/** Catalog icons are explicit, so adding content also requires choosing its art. */
export function contentIcon(kind,id,cls=''){
 const aliases={relic:'relics',talent:'talents',item:'items',messenger:'messengers'},group=aliases[kind]||kind;
 const catalog=Object.hasOwn(CONTENT_STICKERS,group)?CONTENT_STICKERS[group]:null;
 return catalog&&Object.hasOwn(catalog,id)?svg(catalog[id],`${group}:${id}`,cls):stickerIcon('unknown',cls);
}
export const STICKER_STYLE=Object.freeze({viewBox:48,palettes:Object.keys(palettes).length,filters:false,externalResources:false});
