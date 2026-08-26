import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

/*
 * لوگوی جدید فاران
 *
 * فایل لوگو باید در این مسیر قرار بگیرد:
 * public/logo.png
 */
const LOGO_SRC = '/logo.png';

const emptyRow = () => ({
  date: '',
  place: '',
  service: '',
  invoice: '',
  description: '',
  amount: ''
});

const initialRows = Array.from({ length: 8 }, emptyRow);

function numberValue(value) {
  return Number(String(value ?? '').replace(/,/g, '')) || 0;
}

function extractExpenseTitle(description) {
  const text = String(description || '').trim();
  if (!text) return '';

  const keywords = [
    'تاکسی', 'ناهار', 'صبحانه', 'شام', 'پذیرایی', 'پارکینگ',
    'بنزین', 'سوخت', 'بلیط', 'بلیت', 'اقامت', 'هتل', 'مترو',
    'اتوبوس', 'اسنپ', 'تپسی'
  ];

  const found = keywords.find(keyword => text.includes(keyword));
  return found || text;
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function App() {
  const [header, setHeader] = useState({
    title: 'فرم صورت ریز هزینه های تنخواه واحد خدمات',
    docCode: 'FI-B-FO-112/00',
    serviceCode: 'FI-B-RE-001/00',
    date: '1404/05/27',
    reviewDate: ''
  });

  const [rows, setRows] = useState(initialRows);

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
    notes: ''
  });

  const [noInvoiceItems, setNoInvoiceItems] = useState([]);

  const [signatures, setSignatures] = useState({
    requester: '',
    confirmer: '',
    issuer: ''
  });

  const [busy, setBusy] = useState(false);
  const [noInvoiceBusy, setNoInvoiceBusy] = useState(false);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    [rows]
  );

  const derivedNoInvoiceItems = useMemo(() => {
    return rows
      .filter(row => String(row.description || '').trim() && numberValue(row.amount) > 0)
      .map(row => ({
        product: extractExpenseTitle(row.description),
        provider: row.place || '',
        qty: '1',
        unitAmount: String(numberValue(row.amount)),
        total: String(numberValue(row.amount)),
        date: row.date || header.date
      }));
  }, [rows, header.date]);

  const noInvoicePages = useMemo(
    () => chunkArray(derivedNoInvoiceItems, 3),
    [derivedNoInvoiceItems]
  );

  const printableNoInvoicePages = noInvoicePages.length > 0 ? noInvoicePages : [[]];

  const noInvoiceTotal = items =>
    items.reduce((sum, item) => sum + numberValue(item.total || item.unitAmount), 0);

  const formatMoney = value =>
    numberValue(value) ? new Intl.NumberFormat('fa-IR').format(numberValue(value)) : '';

  const updateRow = (index, key, value) => {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const updateHeaderDate = value => {
    setHeader(prev => ({ ...prev, date: value }));
    setRows(prev => prev.map(row => ({ ...row, date: value })));
    setNoInvoice(prev => ({ ...prev, date: value }));
  };

  const updateNoInvoiceDate = value => {
    setNoInvoice(prev => ({ ...prev, date: value }));
  };

  const updateNoInvoiceItem = (index, key, value) => {
    setNoInvoiceItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [key]: value };
      if (key === 'unitAmount' || key === 'qty') {
        next.total = String(numberValue(next.unitAmount) * (numberValue(next.qty) || 1));
      }
      return next;
    }));
  };

  const syncNoInvoiceToMain = () => {
    const items = rows
      .filter(row => String(row.description || '').trim() && numberValue(row.amount) > 0)
      .map(row => ({
        product: extractExpenseTitle(row.description),
        provider: row.place || '',
        qty: '1',
        unitAmount: String(numberValue(row.amount)),
        total: String(numberValue(row.amount)),
        date: row.date || header.date
      }));

    setNoInvoiceItems(items);
    setNoInvoice(prev => ({ ...prev, date: header.date }));
  };

  const printAllForms = () => {
    syncNoInvoiceToMain();
    setTimeout(() => window.print(), 100);
  };

  const printMainForm = () => window.print();

  const exportPdf = async () => {
    const node = document.getElementById('print-area');
    if (!node) return;

    setBusy(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 2.5,
        backgroundColor: '#fff',
        useCORS: true
      });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pageW = 297;
      const pageH = 210;
      const margin = 6;
      const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;

      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        (pageW - w) / 2,
        (pageH - h) / 2,
        w,
        h,
        undefined,
        'FAST'
      );

      pdf.save(`فرم-تنخواه-${header.date || 'بدون-تاریخ'}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const printNoInvoiceForm = () => {
    syncNoInvoiceToMain();
    setTimeout(() => window.print(), 100);
  };

  const exportNoInvoicePdf = async () => {
    syncNoInvoiceToMain();
    setNoInvoiceBusy(true);

    try {
      const pages = printableNoInvoicePages.length > 0 ? printableNoInvoicePages : [[]];
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const node = document.getElementById(`no-invoice-print-page-${pageIndex}`);
        if (!node) continue;

        const canvas = await html2canvas(node, {
          scale: 2.5,
          backgroundColor: '#fff',
          useCORS: true
        });

        if (pageIndex > 0) pdf.addPage();

        const pageW = 210;
        const pageH = 297;
        const margin = 4;
        const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;

        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.96),
          'JPEG',
          (pageW - w) / 2,
          (pageH - h) / 2,
          w,
          h,
          undefined,
          'FAST'
        );
      }

      pdf.save(`فرم-صورت-هزینه-بدون-فاکتور-${header.date || 'بدون-تاریخ'}.pdf`);
    } finally {
      setNoInvoiceBusy(false);
    }
  };

  const reset = () => {
    const newDate = header.date;

    setRows(Array.from({ length: 8 }, () => ({ ...emptyRow(), date: newDate })));
    setHeader(h => ({ ...h, reviewDate: '' }));
    setNoInvoice({
      formCode: 'FI-B-FO-135/00',
      referenceCode: 'FI-B-RE-001/00',
      date: newDate,
      requester: '',
      position: '',
      organization: '',
      reason: '',
      approverComment: '',
      approved: null,
      notes: ''
    });
    setNoInvoiceItems([]);
    setSignatures({ requester: '', confirmer: '', issuer: '' });
  };

  const NoInvoiceCopy = ({ items, pageIndex, totalPages }) => {
    const pageTotal = noInvoiceTotal(items);

    return (
      <section className="ni-copy" id={`no-invoice-print-page-${pageIndex}`}>
        <div className="ni-header">
          <div className="ni-codes">
            <div>کد فرم: <b>{noInvoice.formCode}</b></div>
            <div>کد سند مرجع: <b>{noInvoice.referenceCode}</b></div>
          </div>
          <div className="ni-title">فرم صورت هزینه بدون فاکتور</div>
          <div className="ni-logo">
            <img src={LOGO_SRC} alt="فاران" className="faran-logo ni-faran-logo" />
          </div>
        </div>

        <div className="ni-page-info">
          {totalPages > 1 ? `صفحه ${pageIndex + 1} از ${totalPages}` : ''}
        </div>

        <div className="ni-date-row">
          <span>تاریخ: {noInvoice.date || '........ / ........ / ........'}</span>
        </div>

        <div className="ni-requester-row">
          <span>نام و نام خانوادگی درخواست کننده:</span>
          <b>{noInvoice.requester || '................................................'}</b>
          <span>سمت:</span>
          <b>{noInvoice.position || '................................'}</b>
          <span>واحد سازمانی:</span>
          <b>{noInvoice.organization || '..............................'}</b>
        </div>

        <div className="ni-table-wrap">
          <table className="ni-table">
            <thead>
              <tr>
                <th className="ni-col-row">ردیف</th>
                <th>مشخصات کالا / خدمات</th>
                <th>آدرس ارائه دهنده کالا / خدمات</th>
                <th className="ni-col-qty">تعداد</th>
                <th className="ni-col-unit">مبلغ واحد</th>
                <th className="ni-col-total">مبلغ کل (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.product}</td>
                  <td>{item.provider}</td>
                  <td>{item.qty || '1'}</td>
                  <td>{formatMoney(item.unitAmount)}</td>
                  <td>{formatMoney(item.total || item.unitAmount)}</td>
                </tr>
              ))}

              {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td>{items.length + index + 1}</td>
                  <td></td>
                  <td></td>
                  <td>1</td>
                  <td></td>
                  <td></td>
                </tr>
              ))}

              <tr className="ni-total-row">
                <td colSpan="5">جمع کل (ریال)</td>
                <td>{formatMoney(pageTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ni-reason-row">
          <div className="ni-horizontal-label">درخواست کننده</div>
          <div className="ni-reason-content">
            <div>
              <b>دلیل استفاده از کالا / خدمات :</b>
              <span>{noInvoice.reason || '....................................................................................................................'}</span>
            </div>
            {!noInvoice.reason && <div>...................................................................................................................................................</div>}
          </div>
          <div className="ni-sign-cell">
            <div>
              <strong>امضاء درخواست کننده</strong><br />
              <span>{signatures.requester}</span>
            </div>
          </div>
        </div>

        <div className="ni-approval-row">
          <div className="ni-horizontal-label">تایید کننده</div>
          <div className="ni-approval-content">
            <div><b>اظهار نظر تایید کننده:</b> {noInvoice.approverComment}</div>
            <div className="ni-checks">
              <span>با صورت هزینه نامبرده موافقت میشود<i className={noInvoice.approved === true ? 'checked' : ''}></i></span>
              <span>موافقت نمیشود<i className={noInvoice.approved === false ? 'checked' : ''}></i></span>
            </div>
          </div>
          <div className="ni-sign-cell">
            <div>
              <strong>امضاء تایید کننده</strong><br />
              <span>{signatures.confirmer}</span>
            </div>
          </div>
        </div>

        <div className="ni-notes-row">
          <b>توضیحات :</b> {noInvoice.notes}
        </div>
      </section>
    );
  };

  return (
    <div className="app-shell">
      <style>{`
        .faran-logo { width: 42mm; max-width: 100%; height: auto; object-fit: contain; display: block; }
        .brand-logo { width: 38mm; max-width: 100%; height: auto; object-fit: contain; display: block; }
        .ni-faran-logo { width: 40mm; max-width: 90%; }
        .no-invoice-editor { border: 1px solid #999; background: #f8f8f8; padding: 14px; margin-top: 10px; }
        .ni-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .ni-form-grid .wide { grid-column: span 2; }
        .ni-items-editor { margin-top: 12px; overflow-x: auto; }
        .ni-items-editor table { width: 100%; border-collapse: collapse; min-width: 760px; direction: rtl; }
        .ni-items-editor th, .ni-items-editor td { border: 1px solid #aaa; padding: 6px; text-align: center; }
        .ni-items-editor input, .ni-items-editor select { width: 100%; box-sizing: border-box; }
        .ni-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
        .ni-choice { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; padding-top: 8px; }
        .ni-choice label { display: flex; gap: 5px; align-items: center; font-weight: normal; }
        #no-invoice-print-area { direction: rtl; background: #fff; }
        .ni-copy { width: 100%; min-height: 285mm; box-sizing: border-box; border: 1.4px solid #111; padding: 0; background: #fff; margin-bottom: 9mm; font-family: Tahoma, Arial, sans-serif; color: #111; position: relative; }
        .ni-header { height: 31mm; display: grid; grid-template-columns: 27% 46% 27%; border-bottom: 1.2px solid #111; }
        .ni-codes { display: flex; flex-direction: column; justify-content: center; border-left: 1.2px solid #111; font-size: 10px; line-height: 1.9; padding: 0 4mm; }
        .ni-title { display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; border-left: 1.2px solid #111; text-align: center; }
        .ni-logo { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2mm; box-sizing: border-box; }
        .ni-page-info { position: absolute; top: 33mm; left: 5mm; font-size: 8px; }
        .ni-date-row { height: 10mm; border-bottom: 1px solid #111; display: flex; align-items: center; justify-content: flex-start; padding: 0 5mm; font-size: 10px; }
        .ni-requester-row { min-height: 12mm; border-bottom: 1px solid #111; display: flex; align-items: center; gap: 4px; padding: 0 4mm; font-size: 9.5px; white-space: nowrap; overflow: hidden; }
        .ni-requester-row b { font-weight: normal; border-bottom: 1px dotted #111; min-width: 40px; }
        .ni-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
        .ni-table th, .ni-table td { border: 1px solid #777; text-align: center; vertical-align: middle; height: 10mm; padding: 1.5mm; word-break: break-word; }
        .ni-table th { height: 10mm; font-weight: 800; }
        .ni-col-row { width: 8%; } .ni-col-qty { width: 9%; } .ni-col-unit { width: 14%; } .ni-col-total { width: 17%; }
        .ni-total-row td { height: 8mm; font-weight: 700; }
        .ni-reason-row { min-height: 22mm; display: grid; grid-template-columns: 14% 66% 20%; border-top: 0; }
        .ni-approval-row { min-height: 24mm; display: grid; grid-template-columns: 14% 66% 20%; border-top: 1px solid #111; }
        .ni-horizontal-label { border-left: 1px solid #111; display: flex; align-items: center; justify-content: center; writing-mode: horizontal-tb; font-weight: 800; font-size: 10px; white-space: nowrap; text-align: center; }
        .ni-reason-content, .ni-approval-content { padding: 3mm; line-height: 2.1; font-size: 9px; }
        .ni-reason-content span { margin-right: 5px; }
        .ni-sign-cell { display: flex; align-items: center; justify-content: center; text-align: center; border-right: 1px solid #111; font-size: 9px; line-height: 2; }
        .ni-sign-cell strong, .ni-sign-cell span { font-size: 9px; }
        .ni-checks { display: flex; justify-content: center; gap: 18mm; margin-top: 3mm; }
        .ni-checks span { display: flex; align-items: center; gap: 3mm; }
        .ni-checks i { width: 5mm; height: 5mm; border: 1px solid #111; display: inline-block; position: relative; }
        .ni-checks i.checked::after { content: '✓'; position: absolute; inset: -1px 0 0 0; text-align: center; font-size: 12px; font-style: normal; line-height: 5mm; }
        .ni-notes-row { min-height: 10mm; border-top: 1px solid #111; padding: 2mm 4mm; font-size: 9px; line-height: 2; }
        .ni-copy:last-child { margin-bottom: 0; }
        @media print {
          body { background: #fff !important; }
          .no-print, .control-panel, .preview-label { display: none !important; }
          .app-shell { display: block !important; }
          .preview-wrap { width: 100% !important; padding: 0 !important; margin: 0 !important; }
          #print-area { display: block !important; width: 100% !important; page-break-after: always; break-after: page; }
          .no-invoice-preview-wrap, #no-invoice-print-area { display: block !important; }
          .ni-copy { width: 100% !important; height: 285mm; min-height: 285mm; margin: 0 !important; padding: 0 !important; break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; }
          .ni-copy:last-child { break-after: auto; page-break-after: auto; }
          .faran-logo, .brand-logo { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 5mm; }
        }
        @media (max-width: 900px) {
          .ni-form-grid { grid-template-columns: 1fr 1fr; }
          .ni-form-grid .wide { grid-column: span 2; }
          .ni-header { grid-template-columns: 25% 50% 25%; }
          .ni-title { font-size: 15px; }
          .ni-faran-logo { width: 34mm; }
        }
        @media (max-width: 600px) {
          .app-shell { display: block !important; }
          .control-panel { width: 100% !important; box-sizing: border-box; }
          .preview-wrap { width: 100% !important; overflow-x: auto; }
          .ni-form-grid { grid-template-columns: 1fr; }
          .ni-form-grid .wide { grid-column: span 1; }
          .ni-items-editor { overflow-x: auto; }
          .ni-items-editor table { min-width: 720px; }
          .ni-copy { min-width: 700px; }
          .ni-requester-row { font-size: 8px; }
          .ni-title { font-size: 12px; }
          .ni-faran-logo { width: 27mm; }
        }
      `}</style>

      <aside className="control-panel no-print">
        <div className="panel-title">فرم ثبت هزینه</div>
        <p className="hint">مبنای فرم بدون فاکتور، ردیف‌های فرم اصلی است. هر هزینه‌ای که در شرح هزینه فرم اصلی وارد شود و مبلغ داشته باشد، به فرم بدون فاکتور منتقل می‌شود.</p>

        <section>
          <h3>مشخصات سربرگ فرم اصلی</h3>
          <label>عنوان فرم<input value={header.title} onChange={e => setHeader({ ...header, title: e.target.value })} /></label>
          <div className="two-col">
            <label>کد سند<input value={header.docCode} onChange={e => setHeader({ ...header, docCode: e.target.value })} /></label>
            <label>کد سند مرجع<input value={header.serviceCode} onChange={e => setHeader({ ...header, serviceCode: e.target.value })} /></label>
          </div>
          <div className="two-col">
            <label>تاریخ<input value={header.date} onChange={e => updateHeaderDate(e.target.value)} /></label>
            <label>تاریخ واریز<input value={header.reviewDate} onChange={e => setHeader({ ...header, reviewDate: e.target.value })} /></label>
          </div>
        </section>

        <section>
          <h3>ردیف‌های فرم اصلی</h3>
          <div className="mobile-table">
            {rows.map((r, i) => (
              <div className="row-editor" key={i}>
                <b>ردیف {i + 1}</b>
                <input placeholder="تاریخ" value={r.date} onChange={e => updateRow(i, 'date', e.target.value)} />
                <input placeholder="محل مراجعه (بانک/شرکت)" value={r.place} onChange={e => updateRow(i, 'place', e.target.value)} />
                <select value={r.service} onChange={e => updateRow(i, 'service', e.target.value)}>
                  <option value="">نوع خدمات</option>
                  <option value="نصب اولیه">نصب اولیه</option>
                  <option value="پی ام">پی ام</option>
                  <option value="بازدید فنی">بازدید فنی</option>
                  <option value="بازدید فروش">بازدید فروش</option>
                </select>
                <input placeholder="شماره قرارداد / فاکتور" value={r.invoice} onChange={e => updateRow(i, 'invoice', e.target.value)} />
                <input placeholder="شرح هزینه — مثال: تاکسی" value={r.description} onChange={e => updateRow(i, 'description', e.target.value)} />
                <input inputMode="numeric" placeholder="مبلغ (ریال)" value={r.amount} onChange={e => updateRow(i, 'amount', e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="no-invoice-editor">
          <h3>فرم صورت هزینه بدون فاکتور</h3>
          <p className="hint">این فرم به صورت خودکار از فرم اصلی ساخته می‌شود. برای مثال اگر دو ردیف تاکسی در فرم اصلی داشته باشید، دو ردیف جداگانه تاکسی در فرم بدون فاکتور ساخته می‌شود. هر صفحه حداکثر ۳ ردیف دارد.</p>

          <div className="ni-form-grid">
            <label>کد فرم<input value={noInvoice.formCode} onChange={e => setNoInvoice({ ...noInvoice, formCode: e.target.value })} /></label>
            <label>کد سند مرجع<input value={noInvoice.referenceCode} onChange={e => setNoInvoice({ ...noInvoice, referenceCode: e.target.value })} /></label>
            <label>تاریخ<input value={noInvoice.date} onChange={e => updateNoInvoiceDate(e.target.value)} /></label>
            <label>نام و نام خانوادگی درخواست کننده<input value={noInvoice.requester} onChange={e => setNoInvoice({ ...noInvoice, requester: e.target.value })} /></label>
            <label>سمت<input value={noInvoice.position} onChange={e => setNoInvoice({ ...noInvoice, position: e.target.value })} /></label>
            <label>واحد سازمانی<input value={noInvoice.organization} onChange={e => setNoInvoice({ ...noInvoice, organization: e.target.value })} /></label>
            <label className="wide">دلیل استفاده از کالا / خدمات<input value={noInvoice.reason} onChange={e => setNoInvoice({ ...noInvoice, reason: e.target.value })} /></label>
            <label className="wide">اظهار نظر تایید کننده<input value={noInvoice.approverComment} onChange={e => setNoInvoice({ ...noInvoice, approverComment: e.target.value })} /></label>
            <label className="wide">توضیحات<input value={noInvoice.notes} onChange={e => setNoInvoice({ ...noInvoice, notes: e.target.value })} /></label>
          </div>

          <div className="ni-choice">
            <b>نتیجه تایید:</b>
            <label><input type="radio" checked={noInvoice.approved === true} onChange={() => setNoInvoice({ ...noInvoice, approved: true })} /> با صورت هزینه نامبرده موافقت میشود</label>
            <label><input type="radio" checked={noInvoice.approved === false} onChange={() => setNoInvoice({ ...noInvoice, approved: false })} /> موافقت نمیشود</label>
          </div>

          <div className="ni-items-editor">
            <table>
              <thead><tr><th>ردیف</th><th>مشخصات کالا / خدمات</th><th>آدرس ارائه دهنده کالا / خدمات</th><th>تعداد</th><th>مبلغ واحد</th><th>مبلغ کل (ریال)</th></tr></thead>
              <tbody>
                {derivedNoInvoiceItems.length === 0 ? (
                  <tr><td colSpan="6">هنوز هزینه‌ای از فرم اصلی برای فرم بدون فاکتور وجود ندارد.</td></tr>
                ) : (
                  derivedNoInvoiceItems.map((item, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{item.product}</td><td>{item.provider}</td><td>{item.qty}</td><td>{formatMoney(item.unitAmount)}</td><td>{formatMoney(item.total)}</td></tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '10px', padding: '10px', background: '#eef7ff', border: '1px solid #b7d7ef', borderRadius: '6px' }}>
            <b>تعداد فرم‌های بدون فاکتور:</b> {printableNoInvoicePages.length}
            <span style={{ marginRight: '20px' }}><b>تعداد کل هزینه‌ها:</b> {derivedNoInvoiceItems.length}</span>
          </div>

          <div className="ni-actions">
            <button className="primary" onClick={syncNoInvoiceToMain}>↔ بروزرسانی فرم بدون فاکتور</button>
            <button onClick={printNoInvoiceForm}>🖨 چاپ فرم بدون فاکتور</button>
            <button className="primary" onClick={exportNoInvoicePdf} disabled={noInvoiceBusy}>{noInvoiceBusy ? 'در حال ساخت PDF…' : '📄 PDF فرم بدون فاکتور'}</button>
          </div>
        </section>

        <section>
          <h3>امضاها</h3>
          <div className="three-col">
            <label>امضاء درخواست کننده<input value={signatures.requester} onChange={e => setSignatures({ ...signatures, requester: e.target.value })} /></label>
            <label>امضاء تایید کننده<input value={signatures.confirmer} onChange={e => setSignatures({ ...signatures, confirmer: e.target.value })} /></label>
            <label>امضاء تصویب کننده<input value={signatures.issuer} onChange={e => setSignatures({ ...signatures, issuer: e.target.value })} /></label>
          </div>
        </section>

        <div className="actions">
          <button className="primary" onClick={printAllForms}>🖨 چاپ کلی همه فرم‌ها</button>
          <button onClick={printMainForm}>🖨 چاپ فقط فرم اصلی</button>
          <button className="primary" onClick={exportPdf} disabled={busy}>{busy ? 'در حال ساخت PDF…' : '📄 خروجی PDF فرم اصلی'}</button>
          <button className="ghost" onClick={reset}>پاک کردن اطلاعات</button>
        </div>
      </aside>

      <main className="preview-wrap">
        <div className="preview-label no-print">پیش‌نمایش فرم اصلی</div>

        <div id="print-area" className="paper">
          <header className="form-header">
            <div className="brand"><img src={LOGO_SRC} alt="فاران" className="faran-logo brand-logo" /></div>
            <div className="header-title">{header.title}</div>
            <div className="header-codes">
              <div>کد سند : <b>{header.docCode}</b></div>
              <div>کد سند مرجع : <b>{header.serviceCode}</b></div>
              <div>تاریخ : <b>{header.date}</b></div>
            </div>
          </header>

          <table className="expense-table">
            <thead><tr><th className="narrow">ردیف</th><th>تاریخ</th><th>محل مراجعه<br />(بانک / شرکت)</th><th>نوع خدمات</th><th>شماره قرارداد / فاکتور</th><th>شرح هزینه</th><th>مبلغ هزینه (ریال)</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}><td>{i + 1}</td><td>{r.date}</td><td>{r.place}</td><td>{r.service}</td><td>{r.invoice}</td><td className="description">{r.description}</td><td>{formatMoney(r.amount)}</td></tr>
              ))}
              <tr className="total-row"><td colSpan="6">جمع کل هزینه :</td><td>{formatMoney(total)}</td></tr>
              <tr className="review-row"><td colSpan="7">تاریخ واریز: {header.reviewDate}</td></tr>
            </tbody>
          </table>

          <div className="signatures">
            <div><span>تنظیم کننده :</span><strong>{signatures.requester}</strong><em>نام و امضاء</em></div>
            <div><span>تایید کننده :</span><strong>{signatures.confirmer}</strong><em>نام و امضاء</em></div>
            <div><span>تصویب کننده :</span><strong>{signatures.issuer}</strong><em>نام و امضاء</em></div>
          </div>
        </div>

        <div className="no-invoice-preview-wrap">
          <div className="preview-label no-print">پیش‌نمایش فرم‌های هزینه بدون فاکتور</div>
          <div id="no-invoice-print-area">
            {printableNoInvoicePages.map((pageItems, pageIndex) => (
              <NoInvoiceCopy key={pageIndex} items={pageItems} pageIndex={pageIndex} totalPages={printableNoInvoicePages.length} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
