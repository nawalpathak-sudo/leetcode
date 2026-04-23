module.exports=[56842,a=>{"use strict";let b=(0,a.i(95721).default)("trash-2",[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]]);a.s(["Trash2",0,b],56842)},81318,a=>{"use strict";let b=(0,a.i(95721).default)("plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);a.s(["Plus",0,b],81318)},89001,a=>{"use strict";let b=(0,a.i(95721).default)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);a.s(["Loader2",0,b],89001)},20228,a=>{"use strict";let b=(0,a.i(95721).default)("upload",[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]]);a.s(["Upload",0,b],20228)},35718,a=>{"use strict";let b=(0,a.i(95721).default)("check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);a.s(["Check",0,b],35718)},26347,a=>{"use strict";let b=(0,a.i(95721).default)("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);a.s(["BookOpen",0,b],26347)},23846,a=>{"use strict";let b=(0,a.i(95721).default)("link-2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);a.s(["Link2",0,b],23846)},93139,84217,37054,a=>{"use strict";let b,c,d=(0,a.i(95721).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);async function e(a){let{data:b}=await a.from("bos").select("*, bos_subjects(count), bos_assignments(count)").order("name");return b||[]}async function f(a,b){let{data:c}=await a.from("bos_subjects").select("*, bos_subject_categories(code, name)").eq("bos_id",b).order("semester").order("subject_code");return c||[]}async function g(a,b){let{data:c}=await a.from("bos_assignments").select("*").eq("bos_id",b).order("campus_name").order("admission_year",{ascending:!1});return c||[]}async function h(a){let{data:b}=await a.from("bos_subject_categories").select("id, code, name").order("code");return b||[]}async function i(a,b){let{data:c,error:d}=await a.from("bos").insert({name:b.name,program:b.program||"B.Tech",total_semesters:b.total_semesters||8,notes:b.notes}).select().single();if(d)throw d;return c}async function j(a,b,c){let{error:d}=await a.from("bos").update(c).eq("id",b);if(d)throw d}async function k(a,b){let{error:c}=await a.from("bos").delete().eq("id",b);if(c)throw c}async function l(a,b){let{data:c,error:d}=await a.from("bos_subjects").insert(b).select("*, bos_subject_categories(code, name)").single();if(d)throw d;return c}async function m(a,b,c){let{data:d,error:e}=await a.from("bos_subjects").update(c).eq("id",b).select("*, bos_subject_categories(code, name)").single();if(e)throw e;return d}async function n(a,b){let{error:c}=await a.from("bos_subjects").delete().eq("id",b);if(c)throw c}async function o(a,b){let{data:c,error:d}=await a.from("bos_assignments").insert({bos_id:b.bos_id,campus_name:b.campus_name,admission_year:b.admission_year,current_semester:b.current_semester||1}).select().single();if(d)throw d;return c}async function p(a,b,c){let{error:d}=await a.from("bos_assignments").update(c).eq("id",b);if(d)throw d}async function q(a,b){let{error:c}=await a.from("bos_assignments").delete().eq("id",b);if(c)throw c}async function r(a){let{data:b}=await a.from("master_campuses").select("id, name").eq("active",!0).order("name");return b||[]}async function s(a,b){let{data:c}=await a.from("master_batches").select("id, admission_year").eq("campus_id",b).eq("active",!0).order("admission_year",{ascending:!1});return c||[]}a.s(["ArrowLeft",0,d],93139),a.s(["computeCredits",0,function(a,b,c){let d=(a||0)+(b||0),e=Math.floor((c||0)/2);return{theory:d,practical:e,total:d+e,hours:(a||0)+(b||0)+(c||0)}},"createBOS",0,i,"createBOSAssignment",0,o,"createBOSSubject",0,l,"deleteBOS",0,k,"deleteBOSAssignment",0,q,"deleteBOSSubject",0,n,"fetchBOSAssignments",0,g,"fetchBOSList",0,e,"fetchBOSSubjects",0,f,"fetchBatches",0,s,"fetchCampuses",0,r,"fetchCategories",0,h,"semesterSummary",0,function(a,b){let c=a.filter(a=>a.semester===b);return{count:c.length,totalCredits:c.reduce((a,b)=>a+(b.total_credits||0),0),totalContact:c.reduce((a,b)=>a+(b.lecture_hours||0)+(b.tutorial_hours||0)+(b.practical_hours||0),0),theoryCredits:c.reduce((a,b)=>a+(b.theory_credits||0),0),practicalCredits:c.reduce((a,b)=>a+(b.practical_credits||0),0)}},"updateBOS",0,j,"updateBOSAssignment",0,p,"updateBOSSubject",0,m],84217);var t,u=a.i(39183);let v={data:""},w=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,x=/\/\*[^]*?\*\/|  +/g,y=/\n+/g,z=(a,b)=>{let c="",d="",e="";for(let f in a){let g=a[f];"@"==f[0]?"i"==f[1]?c=f+" "+g+";":d+="f"==f[1]?z(g,f):f+"{"+z(g,"k"==f[1]?"":b)+"}":"object"==typeof g?d+=z(g,b?b.replace(/([^,])+/g,a=>f.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,b=>/&/.test(b)?b.replace(/&/g,a):a?a+" "+b:b)):f):null!=g&&(f=/^--/.test(f)?f:f.replace(/[A-Z]/g,"-$&").toLowerCase(),e+=z.p?z.p(f,g):f+":"+g+";")}return c+(b&&e?b+"{"+e+"}":e)+d},A={},B=a=>{if("object"==typeof a){let b="";for(let c in a)b+=c+B(a[c]);return b}return a};function C(a){let b,c,d=this||{},e=a.call?a(d.p):a;return((a,b,c,d,e)=>{var f;let g=B(a),h=A[g]||(A[g]=(a=>{let b=0,c=11;for(;b<a.length;)c=101*c+a.charCodeAt(b++)>>>0;return"go"+c})(g));if(!A[h]){let b=g!==a?a:(a=>{let b,c,d=[{}];for(;b=w.exec(a.replace(x,""));)b[4]?d.shift():b[3]?(c=b[3].replace(y," ").trim(),d.unshift(d[0][c]=d[0][c]||{})):d[0][b[1]]=b[2].replace(y," ").trim();return d[0]})(a);A[h]=z(e?{["@keyframes "+h]:b}:b,c?"":"."+h)}let i=c&&A.g?A.g:null;return c&&(A.g=A[h]),f=A[h],i?b.data=b.data.replace(i,f):-1===b.data.indexOf(f)&&(b.data=d?f+b.data:b.data+f),h})(e.unshift?e.raw?(b=[].slice.call(arguments,1),c=d.p,e.reduce((a,d,e)=>{let f=b[e];if(f&&f.call){let a=f(c),b=a&&a.props&&a.props.className||/^go/.test(a)&&a;f=b?"."+b:a&&"object"==typeof a?a.props?"":z(a,""):!1===a?"":a}return a+d+(null==f?"":f)},"")):e.reduce((a,b)=>Object.assign(a,b&&b.call?b(d.p):b),{}):e,d.target||v,d.g,d.o,d.k)}C.bind({g:1});let D,E,F,G=C.bind({k:1});function H(a,b){let c=this||{};return function(){let d=arguments;function e(f,g){let h=Object.assign({},f),i=h.className||e.className;c.p=Object.assign({theme:E&&E()},h),c.o=/ *go\d+/.test(i),h.className=C.apply(c,d)+(i?" "+i:""),b&&(h.ref=g);let j=a;return a[0]&&(j=h.as||a,delete h.as),F&&j[0]&&F(h),D(j,h)}return b?b(e):e}}var I=(a,b)=>"function"==typeof a?a(b):a,J=(b=0,()=>(++b).toString()),K="default",L=(a,b)=>{let{toastLimit:c}=a.settings;switch(b.type){case 0:return{...a,toasts:[b.toast,...a.toasts].slice(0,c)};case 1:return{...a,toasts:a.toasts.map(a=>a.id===b.toast.id?{...a,...b.toast}:a)};case 2:let{toast:d}=b;return L(a,{type:+!!a.toasts.find(a=>a.id===d.id),toast:d});case 3:let{toastId:e}=b;return{...a,toasts:a.toasts.map(a=>a.id===e||void 0===e?{...a,dismissed:!0,visible:!1}:a)};case 4:return void 0===b.toastId?{...a,toasts:[]}:{...a,toasts:a.toasts.filter(a=>a.id!==b.toastId)};case 5:return{...a,pausedAt:b.time};case 6:let f=b.time-(a.pausedAt||0);return{...a,pausedAt:void 0,toasts:a.toasts.map(a=>({...a,pauseDuration:a.pauseDuration+f}))}}},M=[],N={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},O={},P=(a,b=K)=>{O[b]=L(O[b]||N,a),M.forEach(([a,c])=>{a===b&&c(O[b])})},Q=a=>Object.keys(O).forEach(b=>P(a,b)),R=(a=K)=>b=>{P(b,a)},S=a=>(b,c)=>{let d,e=((a,b="blank",c)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:b,ariaProps:{role:"status","aria-live":"polite"},message:a,pauseDuration:0,...c,id:(null==c?void 0:c.id)||J()}))(b,a,c);return R(e.toasterId||(d=e.id,Object.keys(O).find(a=>O[a].toasts.some(a=>a.id===d))))({type:2,toast:e}),e.id},T=(a,b)=>S("blank")(a,b);T.error=S("error"),T.success=S("success"),T.loading=S("loading"),T.custom=S("custom"),T.dismiss=(a,b)=>{let c={type:3,toastId:a};b?R(b)(c):Q(c)},T.dismissAll=a=>T.dismiss(void 0,a),T.remove=(a,b)=>{let c={type:4,toastId:a};b?R(b)(c):Q(c)},T.removeAll=a=>T.remove(void 0,a),T.promise=(a,b,c)=>{let d=T.loading(b.loading,{...c,...null==c?void 0:c.loading});return"function"==typeof a&&(a=a()),a.then(a=>{let e=b.success?I(b.success,a):void 0;return e?T.success(e,{id:d,...c,...null==c?void 0:c.success}):T.dismiss(d),a}).catch(a=>{let e=b.error?I(b.error,a):void 0;e?T.error(e,{id:d,...c,...null==c?void 0:c.error}):T.dismiss(d)}),a};var U=G`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,V=G`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,W=G`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,X=H("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${a=>a.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${U} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${V} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${a=>a.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${W} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,Y=G`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,Z=H("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${a=>a.secondary||"#e0e0e0"};
  border-right-color: ${a=>a.primary||"#616161"};
  animation: ${Y} 1s linear infinite;
`,$=G`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,_=G`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,aa=H("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${a=>a.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${$} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${_} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${a=>a.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,ab=H("div")`
  position: absolute;
`,ac=H("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,ad=G`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,ae=H("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${ad} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,af=({toast:a})=>{let{icon:b,type:c,iconTheme:d}=a;return void 0!==b?"string"==typeof b?u.createElement(ae,null,b):b:"blank"===c?null:u.createElement(ac,null,u.createElement(Z,{...d}),"loading"!==c&&u.createElement(ab,null,"error"===c?u.createElement(X,{...d}):u.createElement(aa,{...d})))},ag=H("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,ah=H("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;u.memo(({toast:a,position:b,style:d,children:e})=>{let f=a.height?((a,b)=>{let d=a.includes("top")?1:-1,[e,f]=c?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*d}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*d}%,-1px) scale(.6); opacity:0;}
`];return{animation:b?`${G(e)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${G(f)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(a.position||b||"top-center",a.visible):{opacity:0},g=u.createElement(af,{toast:a}),h=u.createElement(ah,{...a.ariaProps},I(a.message,a));return u.createElement(ag,{className:a.className,style:{...f,...d,...a.style}},"function"==typeof e?e({icon:g,message:h}):u.createElement(u.Fragment,null,g,h))}),t=u.createElement,z.p=void 0,D=t,E=void 0,F=void 0,C`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,a.s(["default",0,T],37054)}];

//# sourceMappingURL=0uuc_lucide-react_dist_esm_icons_0c1r1u0._.js.map