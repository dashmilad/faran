/* فرم بدون فاکتور - قالب دقیق بر اساس تصویر مرجع.
 * منطق React دست‌نخورده می‌ماند؛ این لایه فقط DOM فعلی را می‌خواند و ظاهر چاپی را می‌سازد.
 */
(function () {
  const clean = s => String(s || '').replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
  const text = el => clean(el && el.textContent);
  const esc = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function read(frame) {
    const code = frame.querySelector('.ni-code-box');
    const info = frame.querySelector('.ni-info');
    const table = frame.querySelector('.ni-table');
    const bottom = frame.querySelector('.ni-bottom');
    const notes = frame.querySelector('.notes');
    const cd = code ? code.querySelectorAll(':scope > div') : [];
    const fd = info ? info.querySelectorAll(':scope > div') : [];
    const trs = table ? table.querySelectorAll('tbody tr') : [];
    const cells = trs.length ? Array.from(trs).filter(r => !r.classList.contains('ni-total')).slice(0, 3) : [];

    const itemData = cells.map(r => {
      const td = r.querySelectorAll('td');
      return {
        no: text(td[0]), product: text(td[1]), provider: text(td[2]),
        qty: text(td[3]), unit: text(td[4]), total: text(td[5])
      };
    });

    const bottomCols = bottom ? bottom.querySelectorAll(':scope > div') : [];
    return {
      formCode: text(cd[0] && cd[0].querySelector('b')),
      refCode: text(cd[1] && cd[1].querySelector('b')),
      date: text(fd[0] && fd[0].querySelector('span')),
      requester: text(fd[1] && fd[1].querySelector('span')),
      position: text(fd[2] && fd[2].querySelector('span')),
      organization: text(fd[3] && fd[3].querySelector('span')),
      reason: text(fd[4] && fd[4].querySelector('span')),
      items: itemData,
      total: text(table && table.querySelector('.ni-total td:last-child')),
      requesterBlock: text(bottomCols[0]),
      confirmBlock: text(bottomCols[1]),
      approveBlock: text(bottomCols[2]),
      notes: text(notes)
    };
  }

  function render(frame, v) {
    let exact = frame.querySelector(':scope > .ni-exact');
    if (!exact) {
      exact = document.createElement('div');
      exact.className = 'ni-exact';
      frame.appendChild(exact);
    }

    const signature = JSON.stringify(v);
    if (exact.dataset.signature === signature) return;
    exact.dataset.signature = signature;

    const item = i => v.items[i] || { no: i + 1, product: '', provider: '', qty: '', unit: '', total: '' };
    const rows = [0, 1, 2].map(i => {
      const x = item(i);
      return `<div class="ni-exact-table-row ni-exact-table-cell">
        <div>${esc(x.no || i + 1)}</div><div>${esc(x.product)}</div><div>${esc(x.provider)}</div>
        <div>${esc(x.qty)}</div><div>${esc(x.unit)}</div><div>${esc(x.total || x.unit)}</div>
      </div>`;
    }).join('');

    exact.innerHTML = `
      <div class="ni-exact-header">
        <div class="ni-exact-code">
          <div>کد فرم : <b>${esc(v.formCode)}</b></div>
          <div>کد سند مرجع : <b>${esc(v.refCode)}</b></div>
        </div>
        <div class="ni-exact-title">فرم صورت هزینه بدون فاکتور</div>
        <div class="ni-exact-logo"><img src="./logo.png" alt="فاران"></div>
      </div>

      <div class="ni-exact-date">تاریخ: <b>${esc(v.date)}</b></div>

      <div class="ni-exact-requester">
        <span>نام و نام خانوادگی درخواست کننده :</span><b>${esc(v.requester)}</b>
        <span class="dots"></span>
        <span>سمت :</span><b>${esc(v.position)}</b>
        <span class="dots"></span>
        <span>واحد سازمانی :</span><b>${esc(v.organization)}</b>
      </div>
      <div class="ni-exact-requester-label">درخواست کننده</div>

      <div class="ni-exact-table">
        <div class="ni-exact-table-row ni-exact-table-head">
          <div>ردیف</div><div>مشخصات کالا / خدمات</div><div>آدرس ارائه دهنده کالا / خدمات</div>
          <div>تعداد</div><div>مبلغ واحد</div><div>مبلغ کل (ریال)</div>
        </div>
        ${rows}
        <div class="ni-exact-total"><div>جمع کل (ریال)</div><b>${esc(v.total)}</b></div>
      </div>

      <div class="ni-exact-reason">
        <div class="ni-exact-reason-sign">امضاء درخواست کننده</div>
        <div class="ni-exact-reason-text">
          <b>دلیل استفاده از کالا / خدمات :</b>
          <div class="reason-value">${esc(v.reason)}</div>
        </div>
      </div>

      <div class="ni-exact-opinion">
        <div class="ni-exact-sign-requester">
          <b>امضاء درخواست کننده</b>
          <div class="signature-space"></div>
        </div>
        <div class="ni-exact-confirm">
          <div class="ni-exact-confirm-label">تایید کننده</div>
          <div class="ni-exact-confirm-title">اظهار نظر تایید کننده :</div>
          <div class="ni-exact-checks">
            <span>با صورت هزینه موافقت می‌شود <i class="ni-exact-box"></i></span>
            <span>موافقت نمی‌شود <i class="ni-exact-box"></i></span>
          </div>
        </div>
      </div>

      <div class="ni-exact-notes">توضیحات : <span>${esc(v.notes)}</span></div>
    `;
  }

  function update() {
    document.querySelectorAll('.no-invoice-paper .ni-frame').forEach(frame => render(frame, read(frame)));
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; update(); });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener('DOMContentLoaded', update);
  setTimeout(update, 100);
  setTimeout(update, 500);
  setTimeout(update, 1200);
})();
