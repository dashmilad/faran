/* اصلاح فاصله در تمام ورودی‌های متنی فرم فاران. */
(function(){
  const HIDDEN='\u200B';
  const isTextInput=el=>el instanceof HTMLInputElement && el.type==='text';
  document.addEventListener('beforeinput',function(event){
    const input=event.target;
    if(!isTextInput(input)) return;
    if(event.inputType!=='insertText' || event.data!==' ') return;
    event.preventDefault();
    const start=input.selectionStart ?? input.value.length;
    const end=input.selectionEnd ?? start;
    const before=input.value.slice(0,start);
    const after=input.value.slice(end);
    const insertion=before.endsWith(HIDDEN)?' ':' '+HIDDEN;
    const value=before+insertion+after;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    if(setter) setter.call(input,value); else input.value=value;
    const caret=before.length+insertion.length;
    input.setSelectionRange(caret,caret);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },true);
})();
