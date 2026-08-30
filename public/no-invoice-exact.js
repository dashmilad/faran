/* فرم بدون فاکتور دقیق: از DOM فعلی React فقط داده‌ها را می‌خواند و چیدمان مرجع را می‌سازد. */
(function(){
  const BASE = (window.location.pathname.includes('/mili/') ? '/mili/' : '/');
  const logo = BASE + 'logo.png';
  let busy = false;

  const clean = s => String(s || '').replace(/\u200B/g,'').trim();
  const text = el => clean(el && el.textContent);

  function readOriginal(frame){
    const code = frame.querySelector('.ni-code-box');
    const fields = frame.querySelector('.ni-fields');
    const table = frame.querySelector('.ni-table');
    const sigs = frame.querySelector('.ni-signatures');
    const codeDivs = code ? code.querySelectorAll(':scope > div') : [];
    const fieldDivs = fields ? fields.querySelectorAll(':scope > div') : [];
    const rows = table ? table.querySelectorAll('tbody tr') : [];
    const values = {
      formCode: text(codeDivs[0] && codeDivs[0].querySelector('b')),
      refCode: text(codeDivs[1] && codeDivs[1].querySelector('b')),
      date: text(codeDivs[2] && codeDivs[2].querySelector('b')),
      requester: text(fieldDivs[0] && fieldDivs[0].querySelector('b')),
      position: text(fieldDivs[1] && fieldDivs[1].querySelector('b')),
      organization: text(fieldDivs[2] && fieldDivs[2].querySelector('b')),
      reason: text(fieldDivs[3] && fieldDivs[3].querySelector('b')),
      items: [],
      requesterSig: '',
      confirmerSig: '',
      approverSig: ''
    };
    rows.forEach((r, i) => {
      if(i > 2) return;
      const td = r.querySelectorAll('td');
      if(td.length >= 5) values.items.push({
        no: text(td[0]), product: text(td[1]), provider: text(td[2]), qty: text(td[3]), amount: text(td[4])
      });
    });
    if(sigs){
      const sd = sigs.querySelectorAll(':scope > div');
      values.requesterSig = text(sd[0] && sd[0].querySelector('b'));
      values.confirmerSig = text(sd[1] && sd[1].querySelector('b'));
      values.approverSig = text(sd[2] && sd[2].querySelector('b'));
    }
    return values;
  }

  function render(frame, v){
    let exact = frame.querySelector(':scope > .ni-exact');
    if(!exact){ exact=document.createElement('div'); exact.className='ni-exact'; frame.appendChild(exact); }
    const item = i => v.items[i] || {no:i+1,product:'',provider:'',qty:'',amount:''};
    exact.innerHTML = `
      <div class="ni-exact-header">
        <div class="ni-exact-code">
          <div>کد فرم: <b>${v.formCode}</b></div>
          <div>کد سند مرجع: <b>${v.refCode}</b></div>
        </div>
        <div class="ni-exact-title">فرم صورت هزینه بدون فاکتور</div>
        <div class="ni-exact-logo"><img src="${logo}" alt="فاران"></div>
      </div>
      <div class="ni-exact-date">تاریخ: <b>${v.date}</b></div>
      <div class="ni-exact-requester">
        <span>نام و نام خانوادگی درخواست کننده:</span><span class="dots">........................................................</span>
        <span>واحد سازمانی:</span><span class="dots">........................................</span>
      </div>
      <div class="ni-exact-requester-label">درخواست کننده</div>
      <div class="ni-exact-table">
        <div class="ni-exact-table-row ni-exact-table-head">
          <div>ردیف</div><div>مشخصات کالا / خدمات</div><div>آدرس ارائه دهنده کالا / خدمات</div><div>تعداد</div><div>مبلغ (ریال)</div><div></div>
        </div>
        ${[0,1,2,3].map(i=>{const x=item(i);return `<div class="ni-exact-table-row ni-exact-table-cell"><div>${i+1}</div><div>${x.product}</div><div>${x.provider}</div><div>${x.qty}</div><div>${x.amount}</div><div></div></div>`}).join('')}
      </div>
      <div class="ni-exact-reason">
        <div class="ni-exact-reason-requester">امضاء درخواست کننده</div>
        <div class="ni-exact-reason-text"><b>دلیل استفاده از کالا / خدمات:</b><span class="line">....................................................................................................................</span><span class="line">${v.reason}</span></div>
      </div>
      <div class="ni-exact-opinion">
        <div class="ni-exact-sign-requester">امضاء تایید کننده درخواست کننده:<div class="signature-space"></div>${v.requesterSig ? '<b>'+v.requesterSig+'</b>' : ''}</div>
        <div class="ni-exact-confirm">
          <div class="ni-exact-confirm-label">تایید کننده</div>
          <div class="ni-exact-confirm-title">اظهار نظر تایید کننده</div>
          <div class="ni-exact-checks"><span class="ni-exact-check">موافقت می‌شود <i class="ni-exact-box"></i></span><span class="ni-exact-check">با صورت هزینه موافقت نمی‌شود <i class="ni-exact-box"></i></span></div>
        </div>
      </div>
      <div class="ni-exact-notes">توضیحات: ................................................................................................................................................................................</div>
    `;
  }

  function update(){
    if(busy) return;
    busy=true;
    document.querySelectorAll('.no-invoice-paper .ni-frame').forEach(frame=>render(frame,readOriginal(frame)));
    busy=false;
  }

  const observer = new MutationObserver(()=>{
    if(!busy) requestAnimationFrame(update);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  document.addEventListener('DOMContentLoaded',update);
  setTimeout(update,100);
  setTimeout(update,500);
  setTimeout(update,1200);
})();
