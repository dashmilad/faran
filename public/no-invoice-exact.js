/* فرم بدون فاکتور دقیق: داده‌ها از DOM فعلی React خوانده می‌شوند و روی الگوی تصویری مرجع چیده می‌شوند. */
(function(){
  const BASE=window.location.pathname.includes('/mili/')?'/mili/':'/';
  const logo=BASE+'logo.png';
  let busy=false;
  const clean=s=>String(s||'').replace(/\u200B/g,'').trim();
  const text=el=>clean(el&&el.textContent);
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function readOriginal(frame){
    const code=frame.querySelector('.ni-code-box');
    const fields=frame.querySelector('.ni-fields');
    const table=frame.querySelector('.ni-table');
    const sigs=frame.querySelector('.ni-signatures');
    const cd=code?code.querySelectorAll(':scope > div'):[];
    const fd=fields?fields.querySelectorAll(':scope > div'):[];
    const rows=table?table.querySelectorAll('tbody tr'):[];
    const v={formCode:text(cd[0]&&cd[0].querySelector('b')),refCode:text(cd[1]&&cd[1].querySelector('b')),date:text(cd[2]&&cd[2].querySelector('b')),requester:text(fd[0]&&fd[0].querySelector('b')),position:text(fd[1]&&fd[1].querySelector('b')),organization:text(fd[2]&&fd[2].querySelector('b')),reason:text(fd[3]&&fd[3].querySelector('b')),items:[],requesterSig:'',confirmerSig:'',approverSig:''};
    rows.forEach((r,i)=>{if(i>2)return;const td=r.querySelectorAll('td');if(td.length>=5)v.items.push({no:text(td[0]),product:text(td[1]),provider:text(td[2]),qty:text(td[3]),amount:text(td[4])});});
    if(sigs){const sd=sigs.querySelectorAll(':scope > div');v.requesterSig=text(sd[0]&&sd[0].querySelector('b'));v.confirmerSig=text(sd[1]&&sd[1].querySelector('b'));v.approverSig=text(sd[2]&&sd[2].querySelector('b'));}
    return v;
  }

  function render(frame,v){
    let exact=frame.querySelector(':scope > .ni-exact');
    if(!exact){exact=document.createElement('div');exact.className='ni-exact';frame.appendChild(exact);}
    const signature=JSON.stringify(v);
    if(exact.dataset.signature===signature)return;
    exact.dataset.signature=signature;
    const item=i=>v.items[i]||{product:'',provider:'',qty:'',amount:''};
    exact.innerHTML=`
      <div class="ni-exact-header">
        <div class="ni-exact-code"><div>کد فرم: <b>${esc(v.formCode)}</b></div><div>کد سند مرجع: <b>${esc(v.refCode)}</b></div></div>
        <div class="ni-exact-title">فرم صورت هزینه بدون فاکتور</div>
        <div class="ni-exact-logo"><img src="${logo}" alt="فاران"></div>
      </div>
      <div class="ni-exact-date">تاریخ: <b>${esc(v.date)}</b></div>
      <div class="ni-exact-requester"><span>نام و نام خانوادگی درخواست کننده:</span><b>${esc(v.requester)}</b><span class="dots">....................................</span><span>واحد سازمانی:</span><b>${esc(v.organization)}</b></div>
      <div class="ni-exact-requester-label">درخواست کننده</div>
      <div class="ni-exact-table">
        <div class="ni-exact-table-row ni-exact-table-head"><div>ردیف</div><div>مشخصات کالا / خدمات</div><div>آدرس ارائه دهنده کالا / خدمات</div><div>تعداد</div><div>مبلغ واحد</div><div>مبلغ کل (ریال)</div></div>
        ${[0,1,2,3].map(i=>{const x=item(i);return `<div class="ni-exact-table-row ni-exact-table-cell"><div>${i+1}</div><div>${esc(x.product)}</div><div>${esc(x.provider)}</div><div>${esc(x.qty)}</div><div>${esc(x.amount)}</div><div>${esc(x.amount)}</div></div>`}).join('')}
      </div>
      <div class="ni-exact-reason">
        <div class="ni-exact-reason-requester">امضاء درخواست کننده</div>
        <div class="ni-exact-reason-text"><b>دلیل استفاده از کالا / خدمات:</b><span class="line">....................................................................................................................</span><span class="line">${esc(v.reason)}</span></div>
      </div>
      <div class="ni-exact-opinion">
        <div class="ni-exact-sign-requester">امضاء درخواست کننده:<div class="signature-space"></div>${v.requesterSig?'<b>'+esc(v.requesterSig)+'</b>':''}</div>
        <div class="ni-exact-confirm"><div class="ni-exact-confirm-label">تایید کننده</div><div class="ni-exact-confirm-title">اظهار نظر تایید کننده</div><div class="ni-exact-checks"><span class="ni-exact-check">موافقت می‌شود <i class="ni-exact-box"></i></span><span class="ni-exact-check">با صورت هزینه موافقت نمی‌شود <i class="ni-exact-box"></i></span></div></div>
      </div>
      <div class="ni-exact-notes">توضیحات: ................................................................................................................................................................................</div>
    `;
  }

  function update(){if(busy)return;busy=true;document.querySelectorAll('.no-invoice-paper .ni-frame').forEach(f=>render(f,readOriginal(f)));busy=false;}
  const observer=new MutationObserver(()=>{if(!busy)requestAnimationFrame(update);});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  document.addEventListener('DOMContentLoaded',update);
  setTimeout(update,100);setTimeout(update,500);setTimeout(update,1200);
})();
