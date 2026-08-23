import { deflateSync } from 'node:zlib';

const FONT = {
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'],'9':['111','101','111','001','111'],'A':['010','101','111','101','101'],'B':['110','101','110','101','110'],
  'C':['111','100','100','100','111'],'D':['110','101','101','101','110'],'E':['111','100','110','100','111'],'F':['111','100','110','100','100'],
  '#':['101','111','101','111','101'],' ':['000','000','000','000','000']
};

export function buildColorImagePng(colors) {
  const width=1200, header=80, cellW=120, cellH=92, height=header+cellH*10;
  const pixels=Buffer.alloc(width*height*4);
  fill(pixels,width,height,0,0,width,height,[17,24,39,255]);
  drawText(pixels,width,height,'SERVER COLORS',472,20,4,[255,255,255,255]);
  for(let i=0;i<colors.length;i++){
    const c=colors[i], x=(i%10)*cellW, y=header+Math.floor(i/10)*cellH, rgb=hex(c.hex), text=contrast(rgb);
    fill(pixels,width,height,x+2,y+2,cellW-4,cellH-4,[...rgb,255]);
    const n=String(c.number).padStart(2,'0');
    drawText(pixels,width,height,n,x+48,y+25,5,text);
    drawText(pixels,width,height,c.hex,x+34,y+61,2,text);
  }
  return png(width,height,pixels);
}

function hex(h){const v=h.replace('#','');return[parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)];}
function contrast([r,g,b]){return(r*299+g*587+b*114)/1000>155?[17,24,39,255]:[255,255,255,255];}
function fill(p,w,h,x,y,ww,hh,c){for(let py=Math.max(0,y);py<Math.min(h,y+hh);py++)for(let px=Math.max(0,x);px<Math.min(w,x+ww);px++){const o=(py*w+px)*4;p[o]=c[0];p[o+1]=c[1];p[o+2]=c[2];p[o+3]=c[3];}}
function drawText(p,w,h,text,x,y,s,c){let cur=x;for(const ch of String(text).toUpperCase()){const g=FONT[ch]||FONT[' '];for(let r=0;r<5;r++)for(let col=0;col<3;col++)if(g[r][col]==='1')fill(p,w,h,cur+col*s,y+r*s,s,s,c);cur+=4*s;}}
function png(w,h,rgba){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const rs=y*(w*4+1);raw[rs]=0;rgba.copy(raw,rs+1,y*w*4,(y+1)*w*4);}const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const id=deflateSync(raw);return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',id),chunk('IEND',Buffer.alloc(0))]);}
function chunk(type,data){const t=Buffer.from(type);const l=Buffer.alloc(4);l.writeUInt32BE(data.length);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([l,t,data,c]);}
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^(0xedb88320&-(c&1));}return(c^0xffffffff)>>>0;}
