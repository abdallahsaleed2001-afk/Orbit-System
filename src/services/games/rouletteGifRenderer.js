const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '@':['01110','10001','10111','10101','10111','10000','01110'],'_':['00000','00000','00000','00000','00000','00000','11111'],'.':['00000','00000','00000','00000','00000','00110','00110'],'-':['00000','00000','00000','11111','00000','00000','00000'],'?':['01110','10001','00001','00010','00100','00000','00100'],' ':['00000','00000','00000','00000','00000','00000','00000']
};

const COLORS=['#0b0d11','#171a21','#f7f8fa','#a7afbd','#5865f2','#57f287','#ed4245','#f0b90b','#9b59b6','#e67e22','#3498db','#1abc9c','#242832','#fff2b2','#11141a','#ffffff'];
const rgb=hex=>{const n=Number.parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];};
export const PALETTE=COLORS.map(rgb);

export const cleanName=(value,max=16)=>{
  const s=String(value??'').normalize('NFKD').replace(/[^A-Za-z0-9_@.\- ]/g,'?').trim();
  return s.length>max?`${s.slice(0,max-1)}…`:s;
};

const pixel=(p,w,x,y,c)=>{if(x<0||y<0||x>=w||y>=p.length/(w*3))return;const i=(y*w+x)*3;p[i]=c[0];p[i+1]=c[1];p[i+2]=c[2];};
const rect=(p,w,h,x,y,rw,rh,c)=>{for(let yy=Math.max(0,y);yy<Math.min(h,y+rh);yy++)for(let xx=Math.max(0,x);xx<Math.min(w,x+rw);xx++)pixel(p,w,xx,yy,c);};

function text(p,w,h,value,x,y,scale,color,align='left',maxWidth=Infinity){
  const chars=[...String(value).toUpperCase()],cw=5*scale,gap=scale;
  const maxChars=Number.isFinite(maxWidth)?Math.max(1,Math.floor((maxWidth+gap)/(cw+gap))):chars.length;
  const shown=chars.slice(0,maxChars),total=shown.length*(cw+gap)-gap;
  let sx=x;if(align==='center')sx-=total/2;if(align==='right')sx-=total;
  shown.forEach((ch,i)=>{const glyph=FONT[ch]||FONT['?'],gx=Math.round(sx+i*(cw+gap));glyph.forEach((row,ry)=>[...row].forEach((bit,rx)=>{if(bit==='1')rect(p,w,h,gx+rx*scale,y+ry*scale,scale,scale,color);}));});
}

function sector(p,w,h,cx,cy,radius,start,end,color){
  const minX=Math.max(0,Math.floor(cx-radius)),maxX=Math.min(w-1,Math.ceil(cx+radius));
  const minY=Math.max(0,Math.floor(cy-radius)),maxY=Math.min(h-1,Math.ceil(cy+radius));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy>radius*radius)continue;
    let a=Math.atan2(dy,dx);while(a<0)a+=Math.PI*2;let s=start,e=end;while(s<0){s+=Math.PI*2;e+=Math.PI*2;}while(a<s)a+=Math.PI*2;
    if(a>=s&&a<e)pixel(p,w,x,y,color);
  }
}

function ring(p,w,h,cx,cy,radius,color,thickness=5){
  const outer=radius,inner=radius-thickness;
  for(let y=Math.floor(cy-outer);y<=Math.ceil(cy+outer);y++)for(let x=Math.floor(cx-outer);x<=Math.ceil(cx+outer);x++){
    const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);
    if(d<=outer*outer&&d>=inner*inner)pixel(p,w,x,y,color);
  }
}

function line(p,w,h,x1,y1,x2,y2,color,thickness=2){
  const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0,x=Math.round(x1+(x2-x1)*t),y=Math.round(y1+(y2-y1)*t);rect(p,w,h,x-Math.floor(thickness/2),y-Math.floor(thickness/2),thickness,thickness,color);}
}

function wheelName(p,w,h,player,cx,cy,radius,angle,count,color){
  const maxChars=count<=6?13:count<=8?10:count<=12?8:6;
  const name=cleanName(player.username,maxChars);
  const scale=count<=8?2:1;
  const rr=radius*0.57;
  const x=cx+Math.cos(angle)*rr,y=cy+Math.sin(angle)*rr;
  const maxWidth=Math.max(22,Math.min(radius*0.48,(2*Math.PI*radius/count)*0.68));
  text(p,w,h,name,x,y-3*scale,scale,color,'center',maxWidth);
}

export function drawRouletteFrame(game,selectedIndex=null,rotation=0){
  const w=700,h=420,p=Buffer.alloc(w*h*3);
  const bg=PALETTE[0],panel=PALETTE[1],white=PALETTE[2],muted=PALETTE[3],blue=PALETTE[4],gold=PALETTE[7];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixel(p,w,x,y,bg);

  // Premium dark card layout — the wheel is the focus.
  rect(p,w,h,14,14,672,392,panel);
  rect(p,w,h,14,14,4,392,blue);
  text(p,w,h,'INFINITY GAMES',36,32,3,white);
  text(p,w,h,`ROULETTE  /  ROUND ${game.round}`,36,58,1,muted);

  const cx=350,cy=216,r=177,count=Math.max(2,game.participants.length),step=Math.PI*2/count;
  const colors=[4,5,6,7,8,9,10,11];

  // Outer shadow/rings.
  ring(p,w,h,cx,cy,r+8,PALETTE[14],9);
  ring(p,w,h,cx,cy,r+3,white,3);

  // Colored slices.
  for(let i=0;i<count;i++){
    const a=-Math.PI/2+rotation+i*step;
    sector(p,w,h,cx,cy,r,a,a+step,PALETTE[colors[i%colors.length]]);
  }

  // Crisp dividers between every player.
  for(let i=0;i<count;i++){
    const a=-Math.PI/2+rotation+i*step;
    line(p,w,h,cx,cy,cx+Math.cos(a)*r,cy+Math.sin(a)*r,PALETTE[14],2);
  }
  ring(p,w,h,cx,cy,r,white,4);

  // Player names are INSIDE their wheel segments.
  for(let i=0;i<count;i++){
    const player=game.participants[i],a=-Math.PI/2+rotation+(i+.5)*step;
    const active=selectedIndex!==null&&game.participants[selectedIndex]?.id===player.id;
    wheelName(p,w,h,player,cx,cy,r,a,count,active?PALETTE[13]:white);
  }

  // Center hub + pointer.
  for(let y=cy-45;y<=cy+45;y++)for(let x=cx-45;x<=cx+45;x++){
    if((x-cx)**2+(y-cy)**2<=45*45)pixel(p,w,x,y,PALETTE[14]);
  }
  ring(p,w,h,cx,cy,45,white,3);
  text(p,w,h,'ORBIT',cx,cy-4,1,white,'center');

  // Fixed top pointer, clearly indicating the winning segment.
  for(let y=31;y<60;y++){
    const half=Math.max(2,Math.floor((y-31)/4));
    for(let x=cx-half;x<=cx+half;x++)pixel(p,w,x,y,gold);
  }
  rect(p,w,h,cx-5,29,10,10,gold);

  const selected=selectedIndex!==null?game.participants[selectedIndex]:null;
  rect(p,w,h,120,374,460,22,PALETTE[14]);
  text(p,w,h,selected?`TURN: ${cleanName(selected.username,24)}`:'SPINNING...',350,380,1,selected?gold:muted,'center',430);

  return p;
}

export { FONT };
