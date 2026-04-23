(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5366,e=>{"use strict";let t=(0,e.i(94897).default)("trash-2",[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]]);e.s(["Trash2",0,t],5366)},91037,e=>{"use strict";let t=(0,e.i(94897).default)("plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);e.s(["Plus",0,t],91037)},97718,e=>{"use strict";let t=(0,e.i(94897).default)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);e.s(["Loader2",0,t],97718)},34853,e=>{"use strict";let t=(0,e.i(94897).default)("upload",[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]]);e.s(["Upload",0,t],34853)},4093,e=>{"use strict";let t=(0,e.i(94897).default)("check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);e.s(["Check",0,t],4093)},42220,e=>{"use strict";let t=(0,e.i(94897).default)("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);e.s(["BookOpen",0,t],42220)},81512,e=>{"use strict";let t=(0,e.i(94897).default)("link-2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);e.s(["Link2",0,t],81512)},54896,49463,38706,e=>{"use strict";let t,r,s=(0,e.i(94897).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);async function a(e){let{data:t}=await e.from("bos").select("*, bos_subjects(count), bos_assignments(count)").order("name");return t||[]}async function o(e,t){let{data:r}=await e.from("bos_subjects").select("*, bos_subject_categories(code, name)").eq("bos_id",t).order("semester").order("subject_code");return r||[]}async function i(e,t){let{data:r}=await e.from("bos_assignments").select("*").eq("bos_id",t).order("campus_name").order("admission_year",{ascending:!1});return r||[]}async function c(e){let{data:t}=await e.from("bos_subject_categories").select("id, code, name").order("code");return t||[]}async function n(e,t){let{data:r,error:s}=await e.from("bos").insert({name:t.name,program:t.program||"B.Tech",total_semesters:t.total_semesters||8,notes:t.notes}).select().single();if(s)throw s;return r}async function l(e,t,r){let{error:s}=await e.from("bos").update(r).eq("id",t);if(s)throw s}async function d(e,t){let{error:r}=await e.from("bos").delete().eq("id",t);if(r)throw r}async function m(e,t){let{data:r,error:s}=await e.from("bos_subjects").insert(t).select("*, bos_subject_categories(code, name)").single();if(s)throw s;return r}async function u(e,t,r){let{data:s,error:a}=await e.from("bos_subjects").update(r).eq("id",t).select("*, bos_subject_categories(code, name)").single();if(a)throw a;return s}async function p(e,t){let{error:r}=await e.from("bos_subjects").delete().eq("id",t);if(r)throw r}async function x(e,t){let{data:r,error:s}=await e.from("bos_assignments").insert({bos_id:t.bos_id,campus_name:t.campus_name,admission_year:t.admission_year,current_semester:t.current_semester||1}).select().single();if(s)throw s;return r}async function b(e,t,r){let{error:s}=await e.from("bos_assignments").update(r).eq("id",t);if(s)throw s}async function h(e,t){let{error:r}=await e.from("bos_assignments").delete().eq("id",t);if(r)throw r}async function f(e){let{data:t}=await e.from("master_campuses").select("id, name").eq("active",!0).order("name");return t||[]}async function v(e,t){let{data:r}=await e.from("master_batches").select("id, admission_year").eq("campus_id",t).eq("active",!0).order("admission_year",{ascending:!1});return r||[]}e.s(["ArrowLeft",0,s],54896),e.s(["computeCredits",0,function(e,t,r){let s=(e||0)+(t||0),a=Math.floor((r||0)/2);return{theory:s,practical:a,total:s+a,hours:(e||0)+(t||0)+(r||0)}},"createBOS",0,n,"createBOSAssignment",0,x,"createBOSSubject",0,m,"deleteBOS",0,d,"deleteBOSAssignment",0,h,"deleteBOSSubject",0,p,"fetchBOSAssignments",0,i,"fetchBOSList",0,a,"fetchBOSSubjects",0,o,"fetchBatches",0,v,"fetchCampuses",0,f,"fetchCategories",0,c,"semesterSummary",0,function(e,t){let r=e.filter(e=>e.semester===t);return{count:r.length,totalCredits:r.reduce((e,t)=>e+(t.total_credits||0),0),totalContact:r.reduce((e,t)=>e+(t.lecture_hours||0)+(t.tutorial_hours||0)+(t.practical_hours||0),0),theoryCredits:r.reduce((e,t)=>e+(t.theory_credits||0),0),practicalCredits:r.reduce((e,t)=>e+(t.practical_credits||0),0)}},"updateBOS",0,l,"updateBOSAssignment",0,b,"updateBOSSubject",0,u],49463);var y,g=e.i(49041);let j={data:""},w=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,N=/\/\*[^]*?\*\/|  +/g,_=/\n+/g,S=(e,t)=>{let r="",s="",a="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?r=o+" "+i+";":s+="f"==o[1]?S(i,o):o+"{"+S(i,"k"==o[1]?"":t)+"}":"object"==typeof i?s+=S(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),a+=S.p?S.p(o,i):o+":"+i+";")}return r+(t&&a?t+"{"+a+"}":a)+s},k={},C=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+C(e[r]);return t}return e};function O(e){let t,r,s=this||{},a=e.call?e(s.p):e;return((e,t,r,s,a)=>{var o;let i=C(e),c=k[i]||(k[i]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(i));if(!k[c]){let t=i!==e?e:(e=>{let t,r,s=[{}];for(;t=w.exec(e.replace(N,""));)t[4]?s.shift():t[3]?(r=t[3].replace(_," ").trim(),s.unshift(s[0][r]=s[0][r]||{})):s[0][t[1]]=t[2].replace(_," ").trim();return s[0]})(e);k[c]=S(a?{["@keyframes "+c]:t}:t,r?"":"."+c)}let n=r&&k.g?k.g:null;return r&&(k.g=k[c]),o=k[c],n?t.data=t.data.replace(n,o):-1===t.data.indexOf(o)&&(t.data=s?o+t.data:t.data+o),c})(a.unshift?a.raw?(t=[].slice.call(arguments,1),r=s.p,a.reduce((e,s,a)=>{let o=t[a];if(o&&o.call){let e=o(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":S(e,""):!1===e?"":e}return e+s+(null==o?"":o)},"")):a.reduce((e,t)=>Object.assign(e,t&&t.call?t(s.p):t),{}):a,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||j})(s.target),s.g,s.o,s.k)}O.bind({g:1});let B,$,A,z=O.bind({k:1});function E(e,t){let r=this||{};return function(){let s=arguments;function a(o,i){let c=Object.assign({},o),n=c.className||a.className;r.p=Object.assign({theme:$&&$()},c),r.o=/ *go\d+/.test(n),c.className=O.apply(r,s)+(n?" "+n:""),t&&(c.ref=i);let l=e;return e[0]&&(l=c.as||e,delete c.as),A&&l[0]&&A(c),B(l,c)}return t?t(a):a}}var I=(e,t)=>"function"==typeof e?e(t):e,M=(t=0,()=>(++t).toString()),P="default",T=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return T(e,{type:+!!e.toasts.find(e=>e.id===s.id),toast:s});case 3:let{toastId:a}=t;return{...e,toasts:e.toasts.map(e=>e.id===a||void 0===a?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let o=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+o}))}}},L=[],q={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},F={},D=(e,t=P)=>{F[t]=T(F[t]||q,e),L.forEach(([e,r])=>{e===t&&r(F[t])})},U=e=>Object.keys(F).forEach(t=>D(e,t)),J=(e=P)=>t=>{D(t,e)},H=e=>(t,r)=>{let s,a=((e,t="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||M()}))(t,e,r);return J(a.toasterId||(s=a.id,Object.keys(F).find(e=>F[e].toasts.some(e=>e.id===s))))({type:2,toast:a}),a.id},V=(e,t)=>H("blank")(e,t);V.error=H("error"),V.success=H("success"),V.loading=H("loading"),V.custom=H("custom"),V.dismiss=(e,t)=>{let r={type:3,toastId:e};t?J(t)(r):U(r)},V.dismissAll=e=>V.dismiss(void 0,e),V.remove=(e,t)=>{let r={type:4,toastId:e};t?J(t)(r):U(r)},V.removeAll=e=>V.remove(void 0,e),V.promise=(e,t,r)=>{let s=V.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let a=t.success?I(t.success,e):void 0;return a?V.success(a,{id:s,...r,...null==r?void 0:r.success}):V.dismiss(s),e}).catch(e=>{let a=t.error?I(t.error,e):void 0;a?V.error(a,{id:s,...r,...null==r?void 0:r.error}):V.dismiss(s)}),e};var R=z`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,G=z`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,K=z`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,Z=E("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${R} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${G} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${K} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,Q=z`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,W=E("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${Q} 1s linear infinite;
`,X=z`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,Y=z`
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
}`,ee=E("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${X} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${Y} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,et=E("div")`
  position: absolute;
`,er=E("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,es=z`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,ea=E("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${es} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,eo=({toast:e})=>{let{icon:t,type:r,iconTheme:s}=e;return void 0!==t?"string"==typeof t?g.createElement(ea,null,t):t:"blank"===r?null:g.createElement(er,null,g.createElement(W,{...s}),"loading"!==r&&g.createElement(et,null,"error"===r?g.createElement(Z,{...s}):g.createElement(ee,{...s})))},ei=E("div")`
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
`,ec=E("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;g.memo(({toast:e,position:t,style:s,children:a})=>{let o=e.height?((e,t)=>{let s=e.includes("top")?1:-1,[a,o]=(()=>{if(void 0===r&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");r=!e||e.matches}return r})()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*s}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*s}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${z(a)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${z(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},i=g.createElement(eo,{toast:e}),c=g.createElement(ec,{...e.ariaProps},I(e.message,e));return g.createElement(ei,{className:e.className,style:{...o,...s,...e.style}},"function"==typeof a?a({icon:i,message:c}):g.createElement(g.Fragment,null,i,c))}),y=g.createElement,S.p=void 0,B=y,$=void 0,A=void 0,O`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,e.s(["default",0,V],38706)},4222,e=>{"use strict";var t=e.i(79036),r=e.i(49041),s=e.i(15419),a=e.i(91037),o=e.i(5366),i=e.i(42220),c=e.i(81512),n=e.i(34853),l=e.i(54896),d=e.i(97718),m=e.i(4093),u=e.i(4709),p=e.i(49463),x=e.i(38706);let b={draft:"bg-amber-50 text-amber-700",approved:"bg-[var(--color-ambient)]/10 text-[var(--color-dark-ambient)]",archived:"bg-[var(--color-primary)]/5 text-[var(--color-primary)]/40"};function h({onSave:e,onCancel:s}){let[a,o]=(0,r.useState)({name:"",program:"B.Tech",total_semesters:8}),i=async t=>{if(t.preventDefault(),!a.name)return x.default.error("Name required");try{await e(a)}catch(e){x.default.error(e.message?.includes("duplicate")?"BOS with this name already exists":e.message)}};return(0,t.jsx)("div",{className:"fixed inset-0 bg-black/40 flex items-center justify-center z-50",onClick:s,children:(0,t.jsxs)("form",{onClick:e=>e.stopPropagation(),onSubmit:i,className:"bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md shadow-xl space-y-4",children:[(0,t.jsx)("h3",{className:"text-lg font-bold text-[var(--color-primary)]",children:"New BOS Template"}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{className:"block text-xs font-medium text-[var(--color-text-secondary)] mb-1",children:"Name"}),(0,t.jsx)("input",{value:a.name,onChange:e=>o({...a,name:e.target.value}),placeholder:"e.g., B.Tech CSE 2024 Curriculum",className:"w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none",autoFocus:!0})]}),(0,t.jsxs)("div",{className:"grid grid-cols-2 gap-3",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{className:"block text-xs font-medium text-[var(--color-text-secondary)] mb-1",children:"Program"}),(0,t.jsx)("input",{value:a.program,onChange:e=>o({...a,program:e.target.value}),className:"w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none"})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{className:"block text-xs font-medium text-[var(--color-text-secondary)] mb-1",children:"Semesters"}),(0,t.jsx)("input",{type:"number",value:a.total_semesters,onChange:e=>o({...a,total_semesters:parseInt(e.target.value)||8}),className:"w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none"})]})]}),(0,t.jsxs)("div",{className:"flex justify-end gap-2 pt-2",children:[(0,t.jsx)("button",{type:"button",onClick:s,className:"px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",children:"Cancel"}),(0,t.jsx)("button",{type:"submit",className:"px-4 py-2 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors",children:"Create"})]})]})})}function f({existingBosId:e,onDone:s,onCancel:a}){let i=!!e,[c,b]=(0,r.useState)("upload"),[h,v]=(0,r.useState)(""),[y,g]=(0,r.useState)("B.Tech"),[j,w]=(0,r.useState)(null),[N,_]=(0,r.useState)(null),[S,k]=(0,r.useState)(""),C=(0,u.createClient)(),O=async()=>{if(!j)return x.default.error("Select a file");if(!i&&!h)return x.default.error("Name required");b("extracting"),k("");try{let e=new FormData;e.append("file",j);let t=await fetch("/api/extract-bos",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("sync_secret")||"alta_sync_2026_secret"}`},body:e}),r=await t.json();if(!r.ok)throw Error(r.error+(r.preview?"\n\nPreview: "+r.preview:""));let s=r.data;if(!s.semesters||!Array.isArray(s.semesters))throw Error("AI did not return semesters. Got: "+JSON.stringify(s).slice(0,200));_(s),b("preview")}catch(e){k(e.message),b("upload"),x.default.error("Extraction failed: "+e.message)}},B=async()=>{if(N){b("saving");try{let t=e;if(!t){let e=Math.max(...N.semesters.map(e=>e.semester),8);t=(await (0,p.createBOS)(C,{name:h,program:y,total_semesters:e})).id}let r=await (0,p.fetchCategories)(C),a={};for(let e of(r.forEach(e=>{a[e.code]=e.id}),N.semesters))for(let r of e.subjects)try{await (0,p.createBOSSubject)(C,{bos_id:t,semester:e.semester,subject_code:r.subject_code||`SEM${e.semester}-${String(e.subjects.indexOf(r)+1).padStart(2,"0")}`,subject_name:r.subject_name,category_id:a[r.category]||null,lecture_hours:parseInt(r.lecture_hours)||0,tutorial_hours:parseInt(r.tutorial_hours)||0,practical_hours:parseInt(r.practical_hours)||0,is_elective:r.is_elective||!1,topics:r.topics||[]})}catch(e){console.warn(`Skip subject ${r.subject_code}:`,e.message)}let o=N.semesters.reduce((e,t)=>e+t.subjects.length,0);x.default.success(`${i?"Added":"Created"} ${o} subjects`),s(t)}catch(e){x.default.error(e.message),b("preview")}}},$=(e,t,r,s)=>{_(a=>{let o=JSON.parse(JSON.stringify(a));return o.semesters[e].subjects[t][r]=s,o})};if("upload"===c)return(0,t.jsxs)("div",{className:"space-y-6",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("button",{onClick:a,className:"flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3",children:[(0,t.jsx)(l.ArrowLeft,{size:12})," Back"]}),(0,t.jsx)("h2",{className:"text-lg font-bold text-[var(--color-primary)]",children:i?"Import more subjects":"Import BOS from file"}),(0,t.jsx)("p",{className:"text-sm text-[var(--color-text-secondary)] mt-0.5",children:i?"Upload a file to add subjects to this BOS":"Upload a BOS PDF or CSV — AI will extract subjects, L-T-P, and topics"})]}),(0,t.jsxs)("div",{className:"bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm space-y-4 max-w-lg",children:[!i&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{className:"block text-xs font-medium text-[var(--color-text-secondary)] mb-1",children:"BOS Name"}),(0,t.jsx)("input",{value:h,onChange:e=>v(e.target.value),placeholder:"e.g., B.Tech CSE — SSU 2024",className:"w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none"})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{className:"block text-xs font-medium text-[var(--color-text-secondary)] mb-1",children:"Program"}),(0,t.jsx)("input",{value:y,onChange:e=>g(e.target.value),className:"w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none"})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{className:"block text-xs font-medium text-[var(--color-text-secondary)] mb-1",children:"PDF File"}),(0,t.jsxs)("label",{className:"flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-ambient)] transition-colors",children:[(0,t.jsx)(n.Upload,{size:20,className:"text-[var(--color-text-secondary)]"}),(0,t.jsx)("span",{className:"text-sm text-[var(--color-text-secondary)]",children:j?j.name:"Click to select PDF or CSV"}),(0,t.jsx)("input",{type:"file",className:"hidden",onChange:e=>{e.target.files?.[0]&&w(e.target.files[0])}})]})]}),S&&(0,t.jsx)("p",{className:"text-xs text-[var(--color-danger)]",children:S}),(0,t.jsx)("button",{onClick:O,disabled:!j||!i&&!h,className:"w-full py-2.5 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors",children:"Extract with AI"})]})]});if("extracting"===c)return(0,t.jsxs)("div",{className:"flex flex-col items-center justify-center py-20",children:[(0,t.jsx)(d.Loader2,{size:32,className:"text-[var(--color-ambient)] animate-spin mb-4"}),(0,t.jsx)("p",{className:"text-sm font-medium text-[var(--color-primary)]",children:"Extracting BOS from PDF..."}),(0,t.jsx)("p",{className:"text-xs text-[var(--color-text-secondary)] mt-1",children:"Gemini 2.5 Flash is reading your document"})]});if("saving"===c)return(0,t.jsxs)("div",{className:"flex flex-col items-center justify-center py-20",children:[(0,t.jsx)(d.Loader2,{size:32,className:"text-[var(--color-ambient)] animate-spin mb-4"}),(0,t.jsx)("p",{className:"text-sm font-medium text-[var(--color-primary)]",children:"Saving BOS..."})]});if(!N?.semesters)return(0,t.jsx)("p",{className:"text-[var(--color-text-secondary)] py-10 text-center",children:"No data extracted. Try again."});let A=N.semesters.reduce((e,t)=>e+(t.subjects?.length||0),0);return(0,t.jsxs)("div",{className:"space-y-5",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("button",{onClick:()=>b("upload"),className:"flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3",children:[(0,t.jsx)(l.ArrowLeft,{size:12})," Back to upload"]}),(0,t.jsxs)("div",{className:"flex items-start justify-between",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("h2",{className:"text-lg font-bold text-[var(--color-primary)]",children:["Preview: ",h]}),(0,t.jsxs)("p",{className:"text-sm text-[var(--color-text-secondary)]",children:[N.semesters.length," semesters · ",A," subjects extracted"]})]}),(0,t.jsxs)("div",{className:"flex items-center gap-2",children:[(0,t.jsx)("button",{onClick:a,className:"px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors",children:"Discard All"}),(0,t.jsxs)("button",{onClick:B,className:"flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors",children:[(0,t.jsx)(m.Check,{size:16})," Save BOS"]})]})]})]}),N.semesters.sort((e,t)=>e.semester-t.semester).map((e,r)=>(0,t.jsxs)("div",{className:"bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden",children:[(0,t.jsxs)("div",{className:"px-5 py-3 bg-[var(--color-hover)] border-b border-[var(--color-border)] flex items-center justify-between",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("span",{className:"text-sm font-semibold text-[var(--color-primary)]",children:["Semester ",e.semester]}),(0,t.jsxs)("span",{className:"text-xs text-[var(--color-text-secondary)] ml-2",children:[e.subjects.length," subjects"]})]}),(0,t.jsx)("button",{onClick:()=>{_(e=>{let t=JSON.parse(JSON.stringify(e));return t.semesters.splice(r,1),t})},className:"text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors",children:"Discard semester"})]}),(0,t.jsx)("div",{className:"overflow-x-auto",children:(0,t.jsxs)("table",{className:"w-full",children:[(0,t.jsx)("thead",{children:(0,t.jsx)("tr",{className:"bg-[var(--color-hover)]",children:["Code","Subject","Cat","L","T","P","Topics",""].map(e=>(0,t.jsx)("th",{className:`px-3 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase ${["L","T","P"].includes(e)?"text-center w-12":"text-left"}`,children:e},e))})}),(0,t.jsx)("tbody",{className:"divide-y divide-[var(--color-border)]",children:e.subjects.map((e,s)=>(0,t.jsxs)("tr",{className:"hover:bg-[var(--color-hover)] group",children:[(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("input",{value:e.subject_code,onChange:e=>$(r,s,"subject_code",e.target.value),className:"w-20 px-1 py-0.5 text-xs font-mono text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none"})}),(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("input",{value:e.subject_name,onChange:e=>$(r,s,"subject_name",e.target.value),className:"w-full px-1 py-0.5 text-sm text-[var(--color-text-primary)] font-medium border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none"})}),(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("input",{value:e.category||"",onChange:e=>$(r,s,"category",e.target.value),className:"w-12 px-1 py-0.5 text-xs text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center"})}),(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("input",{type:"number",min:"0",value:e.lecture_hours,onChange:e=>$(r,s,"lecture_hours",parseInt(e.target.value)||0),className:"w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center"})}),(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("input",{type:"number",min:"0",value:e.tutorial_hours,onChange:e=>$(r,s,"tutorial_hours",parseInt(e.target.value)||0),className:"w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center"})}),(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("input",{type:"number",min:"0",value:e.practical_hours,onChange:e=>$(r,s,"practical_hours",parseInt(e.target.value)||0),className:"w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center"})}),(0,t.jsx)("td",{className:"px-3 py-2 text-[11px] text-[var(--color-text-secondary)] max-w-xs truncate",children:(e.topics||[]).join(", ")||"—"}),(0,t.jsx)("td",{className:"px-3 py-2",children:(0,t.jsx)("button",{onClick:()=>{_(e=>{let t=JSON.parse(JSON.stringify(e));return t.semesters[r].subjects.splice(s,1),t})},className:"opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded transition-opacity",children:(0,t.jsx)(o.Trash2,{size:12})})})]},s))})]})})]},e.semester))]})}e.s(["default",0,function({initialData:e}){let l=(0,s.useRouter)(),d=(0,u.createClient)(),[m,x]=(0,r.useState)(e),[v,y]=(0,r.useState)(!1),[g,j]=(0,r.useState)(!1),w=async()=>{x(await (0,p.fetchBOSList)(d))},N=async e=>{let t=await (0,p.createBOS)(d,e);y(!1),await w(),l.push(`/admin/academics/bos/${t.id}`)},_=async e=>{confirm("Delete this BOS and all subjects/assignments?")&&(await (0,p.deleteBOS)(d,e),w())};return g?(0,t.jsx)(f,{existingBosId:null,onDone:e=>{j(!1),w().then(()=>l.push(`/admin/academics/bos/${e}`))},onCancel:()=>j(!1)}):(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{className:"space-y-6",children:[(0,t.jsxs)("div",{className:"flex items-center justify-between",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("h2",{className:"text-lg font-bold text-[var(--color-primary)]",children:"Board of Studies"}),(0,t.jsx)("p",{className:"text-sm text-[var(--color-text-secondary)] mt-0.5",children:"Curriculum templates — assign to campus x batch"})]}),(0,t.jsxs)("div",{className:"flex gap-2",children:[(0,t.jsxs)("button",{onClick:()=>j(!0),className:"flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-primary)] rounded-lg text-sm font-medium hover:bg-[var(--color-hover)] transition-colors",children:[(0,t.jsx)(n.Upload,{size:16})," Import PDF"]}),(0,t.jsxs)("button",{onClick:()=>y(!0),className:"flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors",children:[(0,t.jsx)(a.Plus,{size:16})," New BOS"]})]})]}),0===m.length?(0,t.jsxs)("div",{className:"bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-16 text-center shadow-sm",children:[(0,t.jsx)(i.BookOpen,{size:40,className:"mx-auto text-[var(--color-text-secondary)] mb-3 opacity-40"}),(0,t.jsx)("p",{className:"text-sm text-[var(--color-text-secondary)]",children:"No BOS templates yet"})]}):(0,t.jsx)("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",children:m.map(e=>(0,t.jsxs)("div",{onClick:()=>l.push(`/admin/academics/bos/${e.id}`),className:"bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm cursor-pointer hover:border-[var(--color-ambient)] transition-all group",children:[(0,t.jsxs)("div",{className:"flex items-start justify-between mb-1",children:[(0,t.jsx)("p",{className:"text-sm font-semibold text-[var(--color-primary)]",children:e.name}),(0,t.jsx)("span",{className:`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${b[e.status]}`,children:e.status})]}),(0,t.jsxs)("p",{className:"text-xs text-[var(--color-text-secondary)]",children:[e.program," · ",e.total_semesters," semesters"]}),(0,t.jsxs)("div",{className:"flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]",children:[(0,t.jsxs)("span",{className:"text-xs text-[var(--color-text-secondary)]",children:[e.bos_subjects?.[0]?.count||0," subjects"]}),(0,t.jsxs)("span",{className:"text-xs text-[var(--color-dark-ambient)] flex items-center gap-1",children:[(0,t.jsx)(c.Link2,{size:11})," ",e.bos_assignments?.[0]?.count||0," batches"]}),(0,t.jsx)("button",{onClick:t=>{t.stopPropagation(),_(e.id)},className:"ml-auto opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-all",children:(0,t.jsx)(o.Trash2,{size:14})})]})]},e.id))})]}),v&&(0,t.jsx)(h,{onSave:N,onCancel:()=>y(!1)})]})}])}]);