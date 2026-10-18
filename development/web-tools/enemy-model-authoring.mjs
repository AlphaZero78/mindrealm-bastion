// Model coordinates follow the licensed Blender sources: X right, Y rear, Z up.
export const part=(label,source,size,position,joint='chassis',rotation=[0,0,0],finish='native',detail=false)=>({label,source,size,position,joint,rotation,finish,motion:'fixed',...(detail?{detail:true}:{})});
export const joint=(id,pivot,parent=null)=>({id,pivot,parent});
export const sp=name=>'space-kit/'+name;
export const td=name=>'tower-defense-kit/'+name;
export const handed=(piece,side)=>side<0?{...piece,mirrorX:true}:piece;
export const mirrored=(label,source,size,position,joints,rotation=[0,0,0],finish='native',detail=false)=>[-1,1].map((side,i)=>handed(part(label+(side<0?' left':' right'),source,size,[side*position[0],position[1],position[2]],joints[i],[rotation[0],rotation[1]*side,rotation[2]*side],finish,detail),side));
