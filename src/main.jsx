import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

const SERVICES = ['pm', 'نصب اولیه', 'بازدید فروش', 'بازدید فنی', 'اعلام خرابی رفاه', 'اعلام خرابی مشتری'];
const NO_INVOICE_KEYWORDS = ['تاکسی', 'ناهار', 'صبحانه', 'شام', 'پذیرایی', 'پارکینگ', 'بنزین', 'سوخت', 'بلیط', 'بلیت', 'اقامت', 'هتل', 'مترو', 'اتوبوس', 'اسنپ', 'تپسی'];

const emptyRow = () => ({ date: '', place: '', service: '', invoice: '', description: '', amount: '' });
const initialRows = Array.from({ length: 8 }, emptyRow);

function numberValue(value) {
  return Number(String(value ?? '').replace(/[,٬]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) || 0;
}

function formatMoney(value) {
  const n = numberValue(value);
  return n ? new Intl.NumberFormat('fa-IR').format(n) : '';
}

function extractExpenseTitle(description) {
  const text = String(description || '').trim();
  const found = NO_INVOICE_KEYWORDS.find(keyword => text.includes(keyword));
  return found || '';
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

// تبدیل تاریخ میلادی به شمسی و برعکس، بدون وابستگی خارجی
function gregorianToJalali(gy, gm, gd) {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

function jalaliToGregorian(jalali) {
  const m = String(jalali || '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return '';
  let jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  jy += 1597;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd;
  days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186;
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const gdm = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  let left = gd;
  while (left > gdm[gm - 1] && gm <= 12) { left -= gdm[gm - 1]; gm++; }
  return `${gy}-${String(gm).padStart(2, '0')}-${String(left).padStart(2, '0')}`;
}

function JalaliDateInput({ value, onChange, placeholder = 'تاریخ شمسی' }) {
  const iso = jalaliToGregorian(value);
  return (
    <div className="jalali-input-wrap">
      <input
        type="date"
        value={iso}
        onChange={e => {
          if (!e.target.value) onChange('');
          else {
            const [y, m, d] = e.target.value.split('-').map(Number);
            onChange(gregorianToJalali(y, m, d));
          }
        }}
        aria-label={placeholder}
      />
      <span>{value || placeholder}</span>
    </div>
  );
}

function App() {
  const [header, setHeader] = useState({
    title: 'فرم صورت ریز هزینه های تنخواه واحد خدمات',
    docCode: 'FI-B-FO-112/00',
    serviceCode: 'FI-B-RE-001/00',
    date: '1404/05/27',
    reviewDate: '',
  });
  const [rows, setRows] = useState(initialRows.map(row => ({ ...row, date: '1404/05/27' })));
  const [noInvoice, setNoInvoice] = useState({
    formCode: 'FI-B-FO-135/00',
    referenceCode: 'FI-B-RE-001/00',
    date: '1404/05/27',
    requester: '',
    position: '',
    organization: '',
    reason: '',
    approverComment: '',
    approved: null,
    notes: '',
  });
  const [signatures, setSignatures] = useState({ requester: '', confirmer: '', issuer: '' });
  const [busy, setBusy] = useState(false);
  const [noInvoiceBusy, setNoInvoiceBusy] = useState(false);

  const total = useMemo(() => rows.reduce((sum, row) => sum + numberValue(row.amount), 0), [rows]);

  const derivedNoInvoiceItems = useMemo(() => rows
    .filter(row => extractExpenseTitle(row.description) && numberValue(row.amount) > 0)
    .map(row => ({
      product: String(row.description).trim(),
      provider: row.place || '',
      qty: '1',
      unitAmount: String(numberValue(row.amount)),
      total: String(numberValue(row.amount)),
      date: row.date || header.date,
    })), [rows, header.date]);

  const noInvoicePages = useMemo(() => chunkArray(derivedNoInvoiceItems, 3), [derivedNoInvoiceItems]);
  const hasNoInvoice = noInvoicePages.length > 0;

  const updateRow = (index, key, value) => setRows(prev => prev.map((row, i) => i === index ? { ...row, [key]: value } : row));

  const updateHeaderDate = value => {
    setHeader(prev => ({ ...prev, date: value }));
    setRows(prev => prev.map(row => ({ ...row, date: value })));
    setNoInvoice(prev => ({ ...prev, date: value }));
  };

  const exportElementPdf = async (node, filename, orientation = 'portrait') => {
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2.5, backgroundColor: '#fff', useCORS: true, logging: false });
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
    const pageW = orientation === 'landscape' ? 297 : 210;
    const pageH = orientation === 'landscape' ? 210 : 297;
    const margin = 5;
    const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, 'FAST');
    pdf.save(filename);
  };

  const exportPdf = async () => {
    const node = document.getElementById('print-area');
    if (!node) return;
    setBusy(true);
    try { await exportElementPdf(node, `فرم-هزینه-${header.date || 'بدون-تاریخ'}.pdf`, 'landscape'); }
    finally { setBusy(false); }
  };

  const exportNoInvoicePdf = async () => {
    if (!hasNoInvoice) return;
    setNoInvoiceBusy(true);
    try {
      let pdf = null;
      for (let i = 0; i < noInvoicePages.length; i++) {
        const node = document.getElementById(`no-invoice-print-page-${i}`);
        if (!node) continue;
        const canvas = await html2canvas(node, { scale: 2.5, backgroundColor: '#fff', useCORS: true, logging: false });
        if (!pdf) pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        else pdf.addPage();
        const ratio = Math.min(200 / canvas.width, 287 / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', (210 - w) / 2, 5, w, h, undefined, 'FAST');
      }
      if (pdf) pdf.save(`فرم-صورت-هزینه-بدون-فاکتور-${header.date || 'بدون-تاریخ'}.pdf`);
    } finally { setNoInvoiceBusy(false); }
  };

  const reset = () => {
    setRows(Array.from({ length: 8 }, () => ({ ...emptyRow(), date: header.date })));
    setHeader(prev => ({ ...prev, reviewDate: '' }));
    setNoInvoice(prev => ({ ...prev, date: header.date, requester: '', position: '', organization: '', reason: '', approverComment: '', approved: null, notes: '' }));
    setSignatures({ requester: '', confirmer: '', issuer: '' });
  };

  const NoInvoiceCopy = ({ items, pageIndex, totalPages }) => {
    const pageTotal = items.reduce((sum, item) => sum + numberValue(item.total), 0);
    return (
      <section className="ni-copy" id={`no-invoice-print-page-${pageIndex}`}>
        <table className="ni-header-table">
          <tbody>
            <tr>
              <td className="ni-header-logo" rowSpan="2"><img src={LOGO_SRC} alt="فاران" className="ni-logo-img" /></td>
              <td className="ni-header-title" rowSpan="2">فرم صورت هزینه بدون فاکتور</td>
              <td className="ni-header-codes"><div>کد فرم : {noInvoice.formCode}</div></td>
            </tr>
            <tr><td className="ni-header-codes"><div>کد سند مرجع : {noInvoice.referenceCode}</div></td></tr>
          </tbody>
        </table>
        {totalPages > 1 && <div className="ni-page-info">صفحه {pageIndex + 1} از {totalPages}</div>}

        <div className="ni-top-section">
          <div className="ni-date-line"><b>تاریخ :</b> {noInvoice.date || '........../........../..........'}</div>
          <div className="ni-info-grid">
            <div><b>نام و نام خانوادگی درخواست کننده :</b> {noInvoice.requester || '........................'}</div>
            <div><b>سمت :</b> {noInvoice.position || '........................'}</div>
            <div><b>واحد سازمانی :</b> {noInvoice.organization || '........................'}</div>
            <div><b>شرح :</b> {noInvoice.reason || '........................'}</div>
          </div>
        </div>

        <table className="ni-table">
          <thead><tr><th>ردیف</th><th>مشخصات کالا / خدمات</th><th>آدرس ارائه دهنده کالا / خدمات</th><th>تعداد</th><th>مبلغ واحد</th><th>مبلغ کل (ریال)</th></tr></thead>
          <tbody>
            {items.map((item, index) => <tr key={index}><td>{index + 1}</td><td>{item.product}</td><td>{item.provider}</td><td>{item.qty}</td><td>{formatMoney(item.unitAmount)}</td><td>{formatMoney(item.total)}</td></tr>)}
            {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, index) => <tr key={`empty-${index}`}><td>{items.length + index + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>)}
            <tr className="ni-total-row"><td colSpan="5">جمع کل (ریال)</td><td>{formatMoney(pageTotal)}</td></tr>
          </tbody>
        </table>

        <div className="ni-bottom-section">
          <div className="ni-bottom-grid">
            <div className="ni-bottom-cell requester-cell"><h4>درخواست کننده</h4><div>دلیل استفاده از کالا / خدمات :</div><div className="line">{noInvoice.reason}</div><div className="signature-line">امضاء درخواست کننده : {signatures.requester}</div></div>
            <div className="ni-bottom-cell approver-cell"><h4>تایید کننده</h4><div className="checkbox-line"><span>☐ موافقت میشود</span><span>☐ موافقت نمیشود</span></div><div className="signature-line">امضاء تایید کننده : {signatures.confirmer}</div></div>
            <div className="ni-bottom-cell comment-cell"><h4>اظهار نظر تایید کننده</h4><div className="line large">{noInvoice.approverComment}</div></div>
          </div>
        </div>
        <div className="ni-notes-field"><b>توضیحات :</b> {noInvoice.notes || '................................................................................................'}</div>
      </section>
    );
  };

  return (
    <div className="app-shell">
      <aside className="control-panel no-print">
        <div className="panel-title">فرم ثبت هزینه</div>
        <p className="hint">اطلاعات را وارد کنید؛ فرم اصلی و فرم بدون فاکتور برای چاپ آماده می‌شوند.</p>

        <section><h3>مشخصات سربرگ فرم اصلی</h3>
          <label>عنوان فرم<input value={header.title} onChange={e => setHeader({ ...header, title: e.target.value })} /></label>
          <div className="two-col"><label>کد سند<input value={header.docCode} onChange={e => setHeader({ ...header, docCode: e.target.value })} /></label><label>کد سند مرجع<input value={header.serviceCode} onChange={e => setHeader({ ...header, serviceCode: e.target.value })} /></label></div>
          <div className="two-col"><label>تاریخ<JalaliDateInput value={header.date} onChange={updateHeaderDate} /></label><label>تاریخ واریز<JalaliDateInput value={header.reviewDate} onChange={v => setHeader({ ...header, reviewDate: v })} /></label></div>
        </section>

        <section><h3>ردیف‌های هزینه</h3><div className="mobile-table">
          {rows.map((r, i) => <div className="row-editor" key={i}><b>ردیف {i + 1}</b>
            <JalaliDateInput value={r.date} onChange={v => updateRow(i, 'date', v)} placeholder="تاریخ" />
            <input placeholder="محل مراجعه (بانک/شرکت)" value={r.place} onChange={e => updateRow(i, 'place', e.target.value)} />
            <select value={r.service} onChange={e => updateRow(i, 'service', e.target.value)}><option value="">نوع خدمات</option>{SERVICES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <input placeholder="شماره قرارداد/فاکتور" value={r.invoice} onChange={e => updateRow(i, 'invoice', e.target.value)} />
            <input placeholder="شرح هزینه" value={r.description} onChange={e => updateRow(i, 'description', e.target.value)} />
            <input inputMode="numeric" placeholder="مبلغ (ریال)" value={r.amount} onChange={e => updateRow(i, 'amount', e.target.value)} />
          </div>)}
        </div></section>

        <section className="no-invoice-editor"><h3>فرم صورت هزینه بدون فاکتور</h3><p className="hint">شرح‌هایی که شامل مواردی مثل تاکسی، بلیط، ناهار، اقامت، سوخت و... باشند، به‌صورت خودکار وارد فرم بدون فاکتور می‌شوند. هر فرم حداکثر ۳ هزینه دارد.</p>
          <div className="ni-form-grid">
            <label>کد فرم<input value={noInvoice.formCode} onChange={e => setNoInvoice({ ...noInvoice, formCode: e.target.value })} /></label>
            <label>کد سند مرجع<input value={noInvoice.referenceCode} onChange={e => setNoInvoice({ ...noInvoice, referenceCode: e.target.value })} /></label>
            <label>تاریخ<JalaliDateInput value={noInvoice.date} onChange={v => setNoInvoice({ ...noInvoice, date: v })} /></label>
            <label>نام و نام خانوادگی درخواست کننده<input value={noInvoice.requester} onChange={e => setNoInvoice({ ...noInvoice, requester: e.target.value })} /></label>
            <label>سمت<input value={noInvoice.position} onChange={e => setNoInvoice({ ...noInvoice, position: e.target.value })} /></label>
            <label>واحد سازمانی<input value={noInvoice.organization} onChange={e => setNoInvoice({ ...noInvoice, organization: e.target.value })} /></label>
            <label className="wide">دلیل استفاده از کالا / خدمات<input value={noInvoice.reason} onChange={e => setNoInvoice({ ...noInvoice, reason: e.target.value })} /></label>
            <label className="wide">اظهار نظر تایید کننده<input value={noInvoice.approverComment} onChange={e => setNoInvoice({ ...noInvoice, approverComment: e.target.value })} /></label>
            <div className="approval-radios"><label><input type="radio" name="approved" checked={noInvoice.approved === true} onChange={() => setNoInvoice({ ...noInvoice, approved: true })} /> موافقت میشود</label><label><input type="radio" name="approved" checked={noInvoice.approved === false} onChange={() => setNoInvoice({ ...noInvoice, approved: false })} /> موافقت نمیشود</label></div>
            <label className="wide">توضیحات<input value={noInvoice.notes} onChange={e => setNoInvoice({ ...noInvoice, notes: e.target.value })} /></label>
          </div>
          <div className="ni-items-editor"><table><thead><tr><th>ردیف</th><th>مشخصات کالا / خدمات</th><th>آدرس ارائه دهنده کالا / خدمات</th><th>تعداد</th><th>مبلغ واحد</th><th>مبلغ کل (ریال)</th></tr></thead><tbody>
            {derivedNoInvoiceItems.length === 0 ? <tr><td colSpan="6">هنوز هزینه‌ای برای فرم بدون فاکتور وجود ندارد.</td></tr> : derivedNoInvoiceItems.map((item, i) => <tr key={i}><td>{i + 1}</td><td>{item.product}</td><td>{item.provider}</td><td>{item.qty}</td><td>{formatMoney(item.unitAmount)}</td><td>{formatMoney(item.total)}</td></tr>)}
          </tbody></table></div>
          <div className="ni-status"><b>تعداد فرم‌های بدون فاکتور:</b> {noInvoicePages.length}<span><b>تعداد کل هزینه‌ها:</b> {derivedNoInvoiceItems.length}</span></div>
          <div className="ni-actions"><button className="primary" onClick={() => setNoInvoice(prev => ({ ...prev, date: header.date }))}>↔ بروزرسانی تاریخ</button><button onClick={() => hasNoInvoice && window.print()} disabled={!hasNoInvoice}>🖨 چاپ فرم بدون فاکتور</button><button className="primary" onClick={exportNoInvoicePdf} disabled={noInvoiceBusy || !hasNoInvoice}>{noInvoiceBusy ? 'در حال ساخت PDF…' : '📄 PDF فرم بدون فاکتور'}</button></div>
        </section>

        <section><h3>امضاها</h3><div className="three-col"><label>تنظیم کننده<input value={signatures.requester} onChange={e => setSignatures({ ...signatures, requester: e.target.value })} /></label><label>تایید کننده<input value={signatures.confirmer} onChange={e => setSignatures({ ...signatures, confirmer: e.target.value })} /></label><label>تصویب کننده<input value={signatures.issuer} onChange={e => setSignatures({ ...signatures, issuer: e.target.value })} /></label></div></section>
        <div className="actions"><button onClick={() => window.print()}>🖨 چاپ کلی همه فرم‌ها</button><button className="primary" onClick={exportPdf} disabled={busy}>{busy ? 'در حال ساخت PDF…' : '📄 خروجی PDF فرم اصلی'}</button><button className="ghost" onClick={reset}>پاک کردن اطلاعات</button></div>
      </aside>

      <main className="preview-wrap">
        <div className="preview-label no-print">پیش‌نمایش فرم اصلی</div>
        <div id="print-area" className="paper main-print-page">
          <table className="header-table"><tbody><tr><td className="header-logo-col" rowSpan="3"><img src={LOGO_SRC} alt="فاران" className="logo-header" /></td><td className="header-title-col" rowSpan="3">{header.title}</td><td className="header-codes-col">کد سند : {header.docCode}</td></tr><tr><td className="header-codes-col">کد سند مرجع : {header.serviceCode}</td></tr><tr><td className="header-codes-col">تاریخ : {header.date}</td></tr></tbody></table>
          <table className="expense-table"><colgroup><col className="col-row"/><col className="col-date"/><col className="col-place"/><col className="col-service"/><col className="col-invoice"/><col className="col-description"/><col className="col-amount"/></colgroup><thead><tr><th>ردیف</th><th>تاریخ</th><th>محل مراجعه<br/>(بانک / شرکت)</th><th>نوع خدمات</th><th>شماره قرارداد / فاکتور</th><th>شرح هزینه</th><th>مبلغ هزینه (ریال)</th></tr></thead><tbody>
            {rows.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.date}</td><td>{r.place}</td><td>{r.service}</td><td>{r.invoice}</td><td className="description-cell">{r.description}</td><td className="amount-cell">{formatMoney(r.amount)}</td></tr>)}
            <tr className="total-row"><td colSpan="2" className="review-cell">تاریخ واریز: {header.reviewDate || '………………'}</td><td colSpan="4" className="total-label">جمع کل هزینه :</td><td className="amount-cell">{formatMoney(total)}</td></tr>
          </tbody></table>
          <div className="signature-row"><div><span>تنظیم کننده :</span><b>{signatures.requester}</b></div><div><span>تایید کننده :</span><b>{signatures.confirmer}</b></div><div><span>تصویب کننده :</span><b>{signatures.issuer}</b></div></div>
        </div>

        {hasNoInvoice && <div className="no-invoice-preview-wrap"><div className="preview-label no-print">پیش‌نمایش فرم‌های هزینه بدون فاکتور</div><div className="no-invoice-pages">{noInvoicePages.map((items, i) => <NoInvoiceCopy key={i} items={items} pageIndex={i} totalPages={noInvoicePages.length} />)}</div></div>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
