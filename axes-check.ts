import { radarAxesOf, activeSubjectsOf, subSubjectLimitsOf, resolveSubSubject } from "./src/lib/subjects";
const subs = [{id:"a",name:"国語"},{id:"b",name:"理科"},{id:"c",name:"社会"},{id:"d",name:"数学"}];
const keys = ["a::古文","b::物理","c::日本史","d"];
const axes = radarAxesOf(subs, keys);
console.log(axes.map(a=>a.key), activeSubjectsOf(subs, keys).map(s=>s.name));
const lim = subSubjectLimitsOf(axes); console.log(lim, resolveSubSubject(subs[0], null, lim.a), resolveSubSubject(subs[3], null, lim.d));
console.log(radarAxesOf(subs, ["a::古文"]).map(a=>a.key), radarAxesOf(subs, null).length);
