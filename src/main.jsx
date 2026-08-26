import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

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

function formatMoney(value) {
  const n = numberValue(value);
  if (!n) return '';
  return new Intl.NumberFormat('fa-IR').format(n);
}

function extractExpenseTitle(description) {
  const text = String(description || '').trim();
  if (!text) return '';
  const keywords = [
    'تاکسی', 'ناهار', 'صبحانه', 'شام', 'پذیرایی', 'پارکینگ',
    'بنزین', 'سوخت', 'بلیط', 'بلیت', 'اقامت', 'هتل',
    'مترو', 'اتوبوس', 'اسنپ', 'تپسی'
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

  const [signatures, setSignatures] = useState({
    requester: '',
    confirmer: '',
    issuer: ''
  });

  const [busy, setBusy] = useState(false);
  const [noInvoiceBusy, setNoInvoiceBusy] = useState(false);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + numberValue(row.amount), 0);
  }, [rows]);

  const derivedNoInvoiceItems = useMemo(() => {
    return rows
      .filter(row => {
        return (
          String(row.description || '').trim() &&
          numberValue(row.amount) > 0
        );
      })
      .map(row => ({
        product: extractExpenseTitle(row.description),
        provider: row.place || '',
        qty: '1',
        unitAmount: String(numberValue(row.amount)),
        total: String(numberValue(row.amount)),
        date: row.date || header.date
      }));
  }, [rows, header.date]);

  const noInvoicePages = useMemo(() => {
    if (derivedNoInvoiceItems.length === 0) {
      return [];
    }
    return chunkArray(derivedNoInvoiceItems, 3);
  }, [derivedNoInvoiceItems]);

  const hasNoInvoice = noInvoicePages.length > 0;

  const updateRow = (index, key, value) => {
    setRows(prev =>
      prev.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      )
    );
  };

  const updateHeaderDate = value => {
    setHeader(prev => ({ ...prev, date: value }));
    setRows(prev => prev.map(row => ({ ...row, date: value })));
    setNoInvoice(prev => ({ ...prev, date: value }));
  };

  const printMainForm = () => {
    window.print();
  };

  const printAllForms = () => {
    window.print();
  };

  const exportPdf = async () => {
    const node = document.getElementById('print-area');
    if (!node) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 2.5,
        backgroundColor: '#fff',
        useCORS: true,
        logging: false
      });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const pageW = 297;
      const pageH = 210;
      const margin = 5;
      const ratio = Math.min(
        (pageW - margin * 2) / canvas.width,
        (pageH - margin * 2) / canvas.height
      );
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
      pdf.save(`فرم-هزینه-${header.date || 'بدون-تاریخ'}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const printNoInvoiceForm = () => {
    if (!hasNoInvoice) return;
    window.print();
  };

  const exportNoInvoicePdf = async () => {
    if (!hasNoInvoice) return;
    setNoInvoiceBusy(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      let addedPage = false;
      for (let pageIndex = 0; pageIndex < noInvoicePages.length; pageIndex++) {
        const node = document.getElementById(`no-invoice-print-page-${pageIndex}`);
        if (!node) continue;
        const canvas = await html2canvas(node, {
          scale: 2.5,
          backgroundColor: '#fff',
          useCORS: true,
          logging: false
        });
        if (addedPage) pdf.addPage();
        const pageW = 210;
        const pageH = 297;
        const margin = 5;
        const maxH = 287;
        const ratio = Math.min(
          (pageW - margin * 2) / canvas.width,
          maxH / canvas.height
        );
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.96),
          'JPEG',
          (pageW - w) / 2,
          margin,
          w,
          h,
          undefined,
          'FAST'
        );
        addedPage = true;
      }
      if (addedPage) {
        pdf.save(`فرم-صورت-هزینه-بدون-فاکتور-${header.date || 'بدون-تاریخ'}.pdf`);
      }
    } finally {
      setNoInvoiceBusy(false);
    }
  };

  const reset = () => {
    const newDate = header.date;
    setRows(
      Array.from({ length: 8 }, () => ({
        ...emptyRow(),
        date: newDate
      }))
    );
    setHeader(prev => ({ ...prev, reviewDate: '' }));
    setNoInvoice(prev => ({
      ...prev,
      date: newDate,
      requester: '',
      position: '',
      organization: '',
      reason: '',
      approverComment: '',
      approved: null,
      notes: ''
    }));
    setSignatures({
      requester: '',
      confirmer: '',
      issuer: ''
    });
  };

  const NoInvoiceCopy = ({ items, pageIndex, totalPages }) => {
    const pageTotal = items.reduce(
      (sum, item) => sum + numberValue(item.total || item.unitAmount),
      0
    );

    return (
      <section
        className="ni-copy"
        id={`no-invoice-print-page-${pageIndex}`}
      >
        {/* سربرگ - طراحی جدید */}
        <div className="ni-header-new">
          <div className="ni-header-left">
            <div className="ni-codes-box">
              <div className="ni-code-row">
                <span className="ni-code-label">کد فرم :</span>
                <span className="ni-code-value">{noInvoice.formCode}</span>
              </div>
              <div className="ni-code-row">
                <span className="ni-code-label">کد سند مرجع :</span>
                <span className="ni-code-value">{noInvoice.referenceCode}</span>
              </div>
            </div>
          </div>

          <div className="ni-header-center">
            <div className="ni-form-title">فرم صورت هزینه بدون فاکتور</div>
          </div>

          <div className="ni-header-right">
            <img src={LOGO_SRC} alt="فاران" className="ni-header-logo" />
          </div>
        </div>

        {/* شماره صفحه */}
        {totalPages > 1 && (
          <div className="ni-page-number">
            صفحه {pageIndex + 1} از {totalPages}
          </div>
        )}

        {/* فیلدهای بالا - تاریخ و مشخصات درخواست کننده */}
        <div className="ni-top-fields">
          <div className="ni-date-field">
            <label>تاریخ :</label>
            <span className="ni-date-value">
              {noInvoice.date || '.......... / .......... / ..........'}
            </span>
          </div>

          <div className="ni-requester-fields">
            <div className="ni-field-item">
              <label>نام و نام خانوادگی درخواست کننده :</label>
              <span>{noInvoice.requester || '..................................'}</span>
            </div>
            <div className="ni-field-item">
              <label>سمت :</label>
              <span>{noInvoice.position || '..............'}</span>
            </div>
            <div className="ni-field-item">
              <label>واحد سازمانی :</label>
              <span>{noInvoice.organization || '..............'}</span>
            </div>
          </div>
        </div>

        {/* جدول هزینه‌ها */}
        <div className="ni-table-wrapper">
          <table className="ni-table-new">
            <thead>
              <tr>
                <th className="ni-col-row">ردیف</th>
                <th>مشخصات کالا / خدمات</th>
                <th>آدرس ارائه دهنده</th>
                <th className="ni-col-qty">تعداد</th>
                <th className="ni-col-unit">مبلغ واحد</th>
                <th className="ni-col-total">مبلغ کل (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="ni-row-num">{index + 1}</td>
                  <td>{item.product}</td>
                  <td>{item.provider}</td>
                  <td className="ni-col-qty">{item.qty || '1'}</td>
                  <td className="ni-col-unit">{formatMoney(item.unitAmount)}</td>
                  <td className="ni-col-total">{formatMoney(item.total || item.unitAmount)}</td>
                </tr>
              ))}

              {Array.from({
                length: Math.max(0, 3 - items.length)
              }).map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td className="ni-row-num">{items.length + index + 1}</td>
                  <td></td>
                  <td></td>
                  <td className="ni-col-qty">1</td>
                  <td className="ni-col-unit"></td>
                  <td className="ni-col-total"></td>
                </tr>
              ))}

              <tr className="ni-total-row">
                <td colSpan="5">جمع کل (ریال)</td>
                <td className="ni-col-total">{formatMoney(pageTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* بخش درخواست کننده */}
        <div className="ni-requester-section">
          <div className="ni-section-label">درخواست کننده</div>

          <div className="ni-reason-box">
            <label className="ni-reason-label">دلیل استفاده از کالا / خدمات :</label>
            <div className="ni-reason-content">
              {noInvoice.reason || '..........................................................................................'}
            </div>
          </div>

          <div className="ni-signature-box">
            <div className="ni-signature-label">امضاء درخواست کننده</div>
            <div className="ni-signature-space">{signatures.requester}</div>
          </div>
        </div>

        {/* بخش تایید کننده */}
        <div className="ni-approver-section">
          <div className="ni-section-label">تایید کننده</div>

          <div className="ni-comment-box">
            <label className="ni-comment-label">اظهار نظر تایید کننده :</label>
            <div className="ni-comment-content">{noInvoice.approverComment}</div>
          </div>

          <div className="ni-approval-checkboxes">
            <label className="ni-checkbox-item">
              <span className="ni-checkbox">
                {noInvoice.approved === true ? '☑' : '☐'}
              </span>
              <span>موافقت میشود</span>
            </label>
            <label className="ni-checkbox-item">
              <span className="ni-checkbox">
                {noInvoice.approved === false ? '☑' : '☐'}
              </span>
              <span>موافقت نمیشود</span>
            </label>
          </div>

          <div className="ni-signature-box">
            <div className="ni-signature-label">امضاء تایید کننده</div>
            <div className="ni-signature-space">{signatures.confirmer}</div>
          </div>
        </div>

        {/* توضیحات */}
        <div className="ni-notes-section">
          <label className="ni-notes-label">توضیحات :</label>
          <div className="ni-notes-content">{noInvoice.notes}</div>
        </div>
      </section>
    );
  };

  return (
    <div className="app-shell">
      {/* کنترل پنل */}
      <aside className="control-panel no-print">
        <div className="panel-title">فرم ثبت هزینه</div>
        <p className="hint">اطلاعات را وارد کنید؛ فرم برای چاپ A4 آماده می‌شود.</p>

        {/* سربرگ */}
        <section>
          <h3>مشخصات سربرگ فرم اصلی</h3>
          <label>
            عنوان فرم
            <input
              value={header.title}
              onChange={e => setHeader({ ...header, title: e.target.value })}
            />
          </label>
          <div className="two-col">
            <label>
              کد سند
              <input
                value={header.docCode}
                onChange={e => setHeader({ ...header, docCode: e.target.value })}
              />
            </label>
            <label>
              کد سند مرجع
              <input
                value={header.serviceCode}
                onChange={e => setHeader({ ...header, serviceCode: e.target.value })}
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              تاریخ
              <input
                value={header.date}
                onChange={e => updateHeaderDate(e.target.value)}
              />
            </label>
            <label>
              تاریخ واریز
              <input
                value={header.reviewDate}
                onChange={e => setHeader({ ...header, reviewDate: e.target.value })}
              />
            </label>
          </div>
        </section>

        {/* ردیف‌های هزینه */}
        <section>
          <h3>ردیف‌های هزینه</h3>
          <div className="mobile-table">
            {rows.map((r, i) => (
              <div className="row-editor" key={i}>
                <b>ردیف {i + 1}</b>
                <input
                  placeholder="تاریخ"
                  value={r.date}
                  onChange={e => updateRow(i, 'date', e.target.value)}
                />
                <input
                  placeholder="محل مراجعه (بانک/شرکت)"
                  value={r.place}
                  onChange={e => updateRow(i, 'place', e.target.value)}
                />
                <input
                  placeholder="نوع خدمات"
                  value={r.service}
                  onChange={e => updateRow(i, 'service', e.target.value)}
                />
                <input
                  placeholder="شماره قرارداد/فاکتور"
                  value={r.invoice}
                  onChange={e => updateRow(i, 'invoice', e.target.value)}
                />
                <input
                  placeholder="شرح هزینه — مثال: تاکسی"
                  value={r.description}
                  onChange={e => updateRow(i, 'description', e.target.value)}
                />
                <input
                  inputMode="numeric"
                  placeholder="مبلغ (ریال)"
                  value={r.amount}
                  onChange={e => updateRow(i, 'amount', e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* فرم بدون فاکتور */}
        <section className="no-invoice-editor">
          <h3>فرم صورت هزینه بدون فاکتور</h3>
          <p className="hint">
            هر هزینه‌ای که در فرم اصلی شرح و مبلغ داشته باشد، به صورت خودکار وارد فرم بدون فاکتور می‌شود.
            <br />
            هر فرم حداکثر ۳ هزینه دارد.
          </p>

          <div className="ni-form-grid">
            <label>
              کد فرم
              <input
                value={noInvoice.formCode}
                onChange={e => setNoInvoice({ ...noInvoice, formCode: e.target.value })}
              />
            </label>
            <label>
              کد سند مرجع
              <input
                value={noInvoice.referenceCode}
                onChange={e => setNoInvoice({ ...noInvoice, referenceCode: e.target.value })}
              />
            </label>
            <label>
              تاریخ
              <input
                value={noInvoice.date}
                onChange={e => setNoInvoice({ ...noInvoice, date: e.target.value })}
              />
            </label>
            <label>
              نام و نام خانوادگی درخواست کننده
              <input
                value={noInvoice.requester}
                onChange={e => setNoInvoice({ ...noInvoice, requester: e.target.value })}
              />
            </label>
            <label>
              سمت
              <input
                value={noInvoice.position}
                onChange={e => setNoInvoice({ ...noInvoice, position: e.target.value })}
              />
            </label>
            <label>
              واحد سازمانی
              <input
                value={noInvoice.organization}
                onChange={e => setNoInvoice({ ...noInvoice, organization: e.target.value })}
              />
            </label>
            <label className="wide">
              دلیل استفاده از کالا / خدمات
              <input
                value={noInvoice.reason}
                onChange={e => setNoInvoice({ ...noInvoice, reason: e.target.value })}
              />
            </label>
            <label className="wide">
              اظهار نظر تایید کننده
              <input
                value={noInvoice.approverComment}
                onChange={e => setNoInvoice({ ...noInvoice, approverComment: e.target.value })}
              />
            </label>
            <div className="approval-radios">
              <label>
                <input
                  type="radio"
                  name="approved"
                  checked={noInvoice.approved === true}
                  onChange={() => setNoInvoice({ ...noInvoice, approved: true })}
                />
                موافقت میشود
              </label>
              <label>
                <input
                  type="radio"
                  name="approved"
                  checked={noInvoice.approved === false}
                  onChange={() => setNoInvoice({ ...noInvoice, approved: false })}
                />
                موافقت نمیشود
              </label>
            </div>
            <label className="wide">
              توضیحات
              <input
                value={noInvoice.notes}
                onChange={e => setNoInvoice({ ...noInvoice, notes: e.target.value })}
              />
            </label>
          </div>

          {/* جدول هزینه‌ها */}
          <div className="ni-items-editor">
            <table>
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>مشخصات کالا / خدمات</th>
                  <th>آدرس ارائه دهنده کالا / خدمات</th>
                  <th>تعداد</th>
                  <th>مبلغ واحد</th>
                  <th>مبلغ کل (ریال)</th>
                </tr>
              </thead>
              <tbody>
                {derivedNoInvoiceItems.length === 0 ? (
                  <tr>
                    <td colSpan="6">هنوز هزینه‌ای برای فرم بدون فاکتور وجود ندارد.</td>
                  </tr>
                ) : (
                  derivedNoInvoiceItems.map((item, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{item.product}</td>
                      <td>{item.provider}</td>
                      <td>{item.qty}</td>
                      <td>{formatMoney(item.unitAmount)}</td>
                      <td>{formatMoney(item.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ni-status">
            <b>تعداد فرم‌های بدون فاکتور:</b> {noInvoicePages.length}
            <span>
              <b>تعداد کل هزینه‌ها:</b> {derivedNoInvoiceItems.length}
            </span>
          </div>

          <div className="ni-actions">
            <button
              className="primary"
              onClick={() => setNoInvoice(prev => ({ ...prev, date: header.date }))}
            >
              ↔ بروزرسانی فرم بدون فاکتور
            </button>
            <button onClick={printNoInvoiceForm} disabled={!hasNoInvoice}>
              🖨 چاپ فرم بدون فاکتور
            </button>
            <button
              className="primary"
              onClick={exportNoInvoicePdf}
              disabled={noInvoiceBusy || !hasNoInvoice}
            >
              {noInvoiceBusy ? 'در حال ساخت PDF…' : '📄 PDF فرم بدون فاکتور'}
            </button>
          </div>
        </section>

        {/* امضاها */}
        <section>
          <h3>امضاها</h3>
          <div className="three-col">
            <label>
              امضاء درخواست کننده
              <input
                value={signatures.requester}
                onChange={e => setSignatures({ ...signatures, requester: e.target.value })}
              />
            </label>
            <label>
              امضاء تایید کننده
              <input
                value={signatures.confirmer}
                onChange={e => setSignatures({ ...signatures, confirmer: e.target.value })}
              />
            </label>
            <label>
              امضاء تصویب کننده
              <input
                value={signatures.issuer}
                onChange={e => setSignatures({ ...signatures, issuer: e.target.value })}
              />
            </label>
          </div>
        </section>

        {/* دکمه‌های اصلی */}
        <div className="actions">
          <button className="primary" onClick={printAllForms}>
            🖨 چاپ کلی همه فرم‌ها
          </button>
          <button onClick={printMainForm}>
            🖨 چاپ فقط فرم اصلی
          </button>
          <button className="primary" onClick={exportPdf} disabled={busy}>
            {busy ? 'در حال ساخت PDF…' : '📄 خروجی PDF فرم اصلی'}
          </button>
          <button className="ghost" onClick={reset}>
            پاک کردن اطلاعات
          </button>
        </div>
      </aside>

      {/* پیش‌نمایش */}
      <main className="preview-wrap">
        <div className="preview-label no-print">پیش‌نمایش فرم اصلی</div>

        {/* فرم اصلی */}
        <div id="print-area" className="paper main-print-page">
          {/* سربرگ - 3 سطری */}
          <table className="header-table">
            <tbody>
              <tr>
                <td className="header-logo-col" rowSpan="3">
                  <img src={LOGO_SRC} alt="فاران" className="logo-header" />
                </td>
                <td className="header-title-col" rowSpan="3">{header.title}</td>
                <td className="header-codes-col">کد سند : {header.docCode}</td>
              </tr>
              <tr>
                <td className="header-codes-col">کد سند مرجع : {header.serviceCode}</td>
              </tr>
              <tr>
                <td className="header-codes-col">تاریخ : {header.date}</td>
              </tr>
            </tbody>
          </table>

          {/* جدول اصلی */}
          <table className="expense-table">
            <thead>
              <tr>
                <th className="th-row">ردیف</th>
                <th className="th-date">تاریخ</th>
                <th className="th-place">محل مراجعه<br/>(بانک / شرکت)</th>
                <th className="th-service">نوع خدمات</th>
                <th className="th-invoice">شماره قرارداد / فاکتور</th>
                <th className="th-desc">شرح هزینه</th>
                <th className="th-amount">مبلغ هزینه (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="td-row">{i + 1}</td>
                  <td className="td-date">{r.date}</td>
                  <td className="td-place">{r.place}</td>
                  <td className="td-service">{r.service}</td>
                  <td className="td-invoice">{r.invoice}</td>
                  <td className="td-desc">{r.description}</td>
                  <td className="td-amount">{formatMoney(r.amount)}</td>
                </tr>
              ))}
              
              {/* ردیف جمع کل */}
              <tr className="tr-total">
                <td className="td-row"></td>
                <td className="td-date"></td>
                <td className="td-place"></td>
                <td className="td-service"></td>
                <td className="td-invoice"></td>
                <td className="td-desc">جمع کل هزینه</td>
                <td className="td-amount">{formatMoney(total)}</td>
              </tr>

              {/* ردیف تاریخ واریز */}
              <tr className="tr-review">
                <td colSpan="7" className="td-review">تاریخ واریز: {header.reviewDate}</td>
              </tr>
            </tbody>
          </table>

          {/* امضاها - جدول */}
          <table className="signatures-table">
            <tbody>
              <tr>
                <td className="sig-cell sig-left">
                  نام و امضاء تنظیم کننده :
                  <div className="sig-space">{signatures.requester}</div>
                </td>
                <td className="sig-cell sig-center">
                  نام و امضاء تایید کننده :
                  <div className="sig-space">{signatures.confirmer}</div>
                </td>
                <td className="sig-cell sig-right">
                  نام و امضاء تصویب کننده :
                  <div className="sig-space">{signatures.issuer}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* فرم بدون فاکتور */}
        {hasNoInvoice && (
          <div id="no-invoice-print-area" className="no-invoice-preview-wrap">
            <div className="preview-label no-print">پیش‌نمایش فرم‌های هزینه بدون فاکتور</div>
            <div className="no-invoice-pages">
              {noInvoicePages.map((pageItems, pageIndex) => (
                <NoInvoiceCopy
                  key={pageIndex}
                  items={pageItems}
                  pageIndex={pageIndex}
                  totalPages={noInvoicePages.length}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
