import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

const emptyRow = () => ({ date: '', place: '', service: '', invoice: '', description: '', amount: '' });

const initialRows = Array.from({ length: 8 }, emptyRow);

function App() {
  const [header, setHeader] = useState({
    title: 'فرم صورت ریز هزینه های تنخواه واحد خدمات',
    docCode: 'FI-B-FO-112/00',
    serviceCode: 'FI-B-RE-001/00',
    date: '1404/05/27',
    reviewDate: '',
    logoText: 'فاران',
  });
  const [rows, setRows] = useState(initialRows);
  const [signatures, setSignatures] = useState({ approver: '', confirmer: '', issuer: '' });
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(String(row.amount).replace(/,/g, '')) || 0), 0), [rows]);

  const updateRow = (index, key, value) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [key]: value } : row));
  };

  const formatMoney = value => {
    const n = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) && n ? new Intl.NumberFormat('fa-IR').format(n) : '';
  };

  const printForm = () => window.print();

  const exportPdf = async () => {
    const node = document.getElementById('print-area');
    if (!node) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(node, { scale: 2.5, backgroundColor: '#fff', useCORS: true });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pageW = 297, pageH = 210;
      const margin = 6;
      const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const w = canvas.width * ratio, h = canvas.height * ratio;
      pdf.addImage(img, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, 'FAST');
      pdf.save(`فرم-هزینه-${header.date || 'بدون-تاریخ'}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setRows(Array.from({ length: 8 }, emptyRow));
    setHeader(h => ({ ...h, reviewDate: '' }));
    setSignatures({ approver: '', confirmer: '', issuer: '' });
  };

  return (
    <div className="app-shell">
      <aside className="control-panel no-print">
        <div className="panel-title">فرم ثبت هزینه</div>
        <p className="hint">اطلاعات را وارد کنید؛ فرم سمت چپ/پایین دقیقاً برای چاپ A4 آماده می‌شود.</p>
        <section>
          <h3>مشخصات سربرگ</h3>
          <label>عنوان فرم<input value={header.title} onChange={e => setHeader({ ...header, title: e.target.value })}/></label>
          <div className="two-col">
            <label>کد سند<input value={header.docCode} onChange={e => setHeader({ ...header, docCode: e.target.value })}/></label>
            <label>کد سند مرجع<input value={header.serviceCode} onChange={e => setHeader({ ...header, serviceCode: e.target.value })}/></label>
          </div>
          <div className="two-col">
            <label>تاریخ<input value={header.date} onChange={e => setHeader({ ...header, date: e.target.value })}/></label>
            <label>تاریخ وارزیابی<input value={header.reviewDate} onChange={e => setHeader({ ...header, reviewDate: e.target.value })}/></label>
          </div>
        </section>
        <section>
          <h3>ردیف‌های هزینه</h3>
          <div className="mobile-table">
            {rows.map((r, i) => <div className="row-editor" key={i}>
              <b>ردیف {i + 1}</b>
              <input placeholder="تاریخ" value={r.date} onChange={e => updateRow(i, 'date', e.target.value)}/>
              <input placeholder="محل مراجعه (بانک/شرکت)" value={r.place} onChange={e => updateRow(i, 'place', e.target.value)}/>
              <input placeholder="نوع خدمات" value={r.service} onChange={e => updateRow(i, 'service', e.target.value)}/>
              <input placeholder="شماره قرارداد/فاکتور" value={r.invoice} onChange={e => updateRow(i, 'invoice', e.target.value)}/>
              <input placeholder="شرح هزینه" value={r.description} onChange={e => updateRow(i, 'description', e.target.value)}/>
              <input inputMode="numeric" placeholder="مبلغ (ریال)" value={r.amount} onChange={e => updateRow(i, 'amount', e.target.value)}/>
            </div>)}
          </div>
        </section>
        <section>
          <h3>امضاها</h3>
          <div className="three-col">
            <label>تنظیم کننده<input value={signatures.approver} onChange={e => setSignatures({ ...signatures, approver: e.target.value })}/></label>
            <label>تایید کننده<input value={signatures.confirmer} onChange={e => setSignatures({ ...signatures, confirmer: e.target.value })}/></label>
            <label>تصویب کننده<input value={signatures.issuer} onChange={e => setSignatures({ ...signatures, issuer: e.target.value })}/></label>
          </div>
        </section>
        <div className="actions">
          <button onClick={printForm}>🖨 چاپ مستقیم</button>
          <button className="primary" onClick={exportPdf} disabled={busy}>{busy ? 'در حال ساخت PDF…' : '📄 خروجی PDF'}</button>
          <button className="ghost" onClick={reset}>پاک کردن اطلاعات</button>
        </div>
      </aside>

      <main className="preview-wrap">
        <div className="preview-label no-print">پیش‌نمایش فرم</div>
        <div id="print-area" className="paper">
          <header className="form-header">
            <div className="brand"><strong>{header.logoText}</strong><small>صنایع الکترونیک فاران</small></div>
            <div className="header-title">{header.title}</div>
            <div className="header-codes">
              <div>کد سند : <b>{header.docCode}</b></div>
              <div>کد سند مرجع : <b>{header.serviceCode}</b></div>
              <div>تاریخ : <b>{header.date}</b></div>
            </div>
          </header>

          <table className="expense-table">
            <thead><tr>
              <th className="narrow">ردیف</th><th>تاریخ</th><th>محل مراجعه (بانک / شرکت)</th><th>نوع خدمات</th><th>شماره قرارداد / فاکتور</th><th>شرح هزینه</th><th>مبلغ هزینه (ریال)</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>
                <td>{i + 1}</td><td>{r.date}</td><td>{r.place}</td><td>{r.service}</td><td>{r.invoice}</td><td className="description">{r.description}</td><td>{formatMoney(r.amount)}</td>
              </tr>)}
              <tr className="total-row"><td colSpan="6">جمع کل هزینه :</td><td>{new Intl.NumberFormat('fa-IR').format(total)}</td></tr>
              <tr className="review-row"><td colSpan="7">تاریخ وارزیابی: {header.reviewDate}</td></tr>
            </tbody>
          </table>

          <div className="signatures">
            <div><span>تنظیم کننده :</span><strong>{signatures.approver}</strong><em>نام و امضاء</em></div>
            <div><span>تایید کننده :</span><strong>{signatures.confirmer}</strong><em>نام و امضاء</em></div>
            <div><span>تصویب کننده :</span><strong>{signatures.issuer}</strong><em>نام و امضاء</em></div>
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
