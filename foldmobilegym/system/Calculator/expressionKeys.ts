/** Fixed mathematical notation and reference-informed wide-grid positions. */
export const SCIENTIFIC_FUNCTION_KEYS = [
 {key:'(',label:'(',col:5,row:5},{key:')',label:')',col:6,row:5},
 {key:'MC',label:'MC',col:1,row:1},{key:'M+',label:'M+',col:2,row:1},{key:'M-',label:'M−',col:3,row:1},{key:'MR',label:'MR',col:4,row:1},
 {key:'factorial',label:'x!',col:5,row:1},{key:'square',label:'x²',col:1,row:2},{key:'cube',label:'x³',col:2,row:2},
 {key:'power',label:'xʸ',col:3,row:2},{key:'exp',label:'eˣ',col:4,row:2},{key:'pi',label:'π',col:5,row:2},
 {key:'reciprocal',label:'1/x',col:1,row:3},{key:'sqrt',label:'√',col:2,row:3},{key:'cbrt',label:'∛',col:3,row:3},{key:'root',label:'ʸ√x',col:4,row:3},
 {key:'inverse',label:'Inv',col:5,row:3},{key:'angle',label:'Rad',col:2,row:4},
 {key:'e',label:'e',col:3,row:4},{key:'ln',label:'ln',col:4,row:4},{key:'log',label:'lg',col:5,row:4},
 {key:'sin',label:'sin',col:2,row:5},{key:'cos',label:'cos',col:3,row:5},{key:'tan',label:'tan',col:4,row:5},
] as const;
export const EXPRESSION_BASIC_KEYS = [
 {key:'clear',label:'C',col:6,row:1},{key:'*',label:'×',col:7,row:1},{key:'/',label:'÷',col:8,row:1},{key:'backspace',label:'⌫',col:9,row:1},
 {key:'7',label:'7',col:6,row:2},{key:'8',label:'8',col:7,row:2},{key:'9',label:'9',col:8,row:2},{key:'-',label:'−',col:9,row:2},
 {key:'4',label:'4',col:6,row:3},{key:'5',label:'5',col:7,row:3},{key:'6',label:'6',col:8,row:3},{key:'+',label:'+',col:9,row:3},
 {key:'1',label:'1',col:6,row:4},{key:'2',label:'2',col:7,row:4},{key:'3',label:'3',col:8,row:4},{key:'percent',label:'%',col:9,row:4},
 {key:'sign',label:'⁺/₋',col:1,row:4,span:2},{key:'0',label:'0',col:7,row:5},{key:'.',label:'.',col:8,row:5},{key:'equals',label:'=',col:9,row:5},
] as const;
