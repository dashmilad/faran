import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

const LOGO_SRC = '/logo.png';

const emptyRow = (date = '') => ({
  date,
  place: '',
  service: '',
  invoice: '',
  description: '',
  amount: ''
});

const initialRows = Array.from({ length: 8 }, () => emptyRow(''));

// فقط گزینه‌های واقعی «نوع خدمات»
const serviceOptions = [
  'PM',
  'نصب اولیه',
  'بازدید فنی',
  'بازدید فروش',
  'اعلام خرابی'
];

// مواردی که فقط از داخل «شرح هزینه» برای فرم بدون فاکتور تشخیص داده می‌شوند
const noInvoiceKeywords = [
  'تاکسی',
  'ناهار',
  'صبحانه',
  'شام',
  'پذیرایی',
  'پارکینگ',
  'بنزین',
  'سوخت',
  'بلیط',
  'اقامت',
  'هتل',
  'مترو',
  'اتوبوس',
  'اسنپ',
  'تپسی'
];

function numberValue(value) {
  return Number(String(value ?? '').replace(/[٬,،\s]/g, '')) || 0;
}

function formatMoney(value) {
  const n = numberValue(value);
  return n ? new Intl.NumberFormat('fa-IR').format(n) : '';
}

// تشخیص موارد بدون فاکتور فقط از روی شرح هزینه
function extractNoInvoiceItems(description) {
  const text = String(description || '').trim();

  if (!text) return [];

  return noInvoiceKeywords.filter(keyword =>
    text.includes(keyword)
  );
}

function chunk(array, size) {
  const out = [];

  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }

  return out;
}

function App() {
  const [header, setHeader] = useState({
    title: 'فرم صورت ریز هزینه های تنخواه واحد خدمات',
    docCode: 'FI-B-FO-112/00',
    refCode: 'FI-B-RE-001/00',
    date: '1405/  /  '
  });

  const [rows, setRows] = useState(initialRows);

  const [signatures, setSignatures] = useState({
    requester: '',
    confirmer: '',
    approver: ''
  });

  const [noInvoice, setNoInvoice] = useState({
    formCode: 'FI-B-FO-135/00',
    refCode: 'FI-B-RE-001/00',
    date: '1405/  /  ',
    requester: '',
    position: '',
    organization: '',
    reason: '',
    notes: ''
  });

  const [busy, setBusy] = useState(false);
  const [noInvoiceBusy, setNoInvoiceBusy] = useState(false);

  const total = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + numberValue(row.amount),
        0
      ),
    [rows]
  );

  /*
   * ساخت اطلاعات فرم بدون فاکتور
   *
   * نکته مهم:
   * این قسمت دیگر به row.service کاری ندارد.
   * فقط متن row.description بررسی می‌شود.
   */
  const noInvoiceItems = useMemo(() => {
    const items = [];

    rows.forEach(row => {
      const description = String(row.description || '').trim();
      const amount = numberValue(row.amount);

      // اگر شرح یا مبلغ وجود نداشته باشد، فرم بدون فاکتور ساخته نمی‌شود
      if (!description || amount <= 0) return;

      // پیدا کردن موارد تعریف‌شده در متن شرح هزینه
      const matchedKeywords = extractNoInvoiceItems(description);

      // برای هر مورد پیدا شده یک ردیف ایجاد می‌شود
      matchedKeywords.forEach(keyword => {
        items.push({
          product: keyword,
          provider: row.place,
          date: row.date || header.date,
          qty: '1',
          unitAmount: String(amount),
          total: String(amount)
        });
      });
    });

    return items;
  }, [rows, header.date]);

  const noInvoiceForms = useMemo(
    () => chunk(noInvoiceItems, 3),
    [noInvoiceItems]
  );

  const updateHeader = (key, value) =>
    setHeader(prev => ({
      ...prev,
      [key]: value
    }));

  const updateDate = value => {
    setHeader(prev => ({
      ...prev,
      date: value
    }));

    setRows(prev =>
      prev.map(row => ({
        ...row,
        date: value
      }))
    );

    setNoInvoice(prev => ({
      ...prev,
      date: value
    }));
  };

  const updateRow = (index, key, value) => {
    setRows(prev =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value
            }
          : row
      )
    );
  };

  const updateSignature = (key, value) =>
    setSignatures(prev => ({
      ...prev,
      [key]: value
    }));

  const updateNoInvoice = (key, value) =>
    setNoInvoice(prev => ({
      ...prev,
      [key]: value
    }));

  const reset = () => {
    setRows(
      Array.from(
        { length: 8 },
        () => emptyRow(header.date)
      )
    );

    setSignatures({
      requester: '',
      confirmer: '',
      approver: ''
    });

    setNoInvoice({
      formCode: 'FI-B-FO-135/00',
      refCode: header.refCode,
      date: header.date,
      requester: '',
      position: '',
      organization: '',
      reason: '',
      notes: ''
    });
  };

  const waitForImages = async node => {
    const images = [...node.querySelectorAll('img')];

    await Promise.all(
      images.map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            })
      )
    );
  };

  const exportMainPdf = async () => {
    const node = document.getElementById('main-print');

    if (!node) return;

    setBusy(true);

    try {
      await waitForImages(node);

      const canvas = await html2canvas(node, {
        scale: 3,
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

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        297,
        210,
        undefined,
        'FAST'
      );

      pdf.save(
        `فرم-تنخواه-${header.date || 'بدون-تاریخ'}.pdf`
      );
    } finally {
      setBusy(false);
    }
  };

  const exportNoInvoicePdf = async () => {
    if (!noInvoiceForms.length) return;

    setNoInvoiceBusy(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let first = true;

      for (
        let i = 0;
        i < noInvoiceForms.length;
        i += 1
      ) {
        const node = document.getElementById(
          `no-invoice-${i}`
        );

        if (!node) continue;

        await waitForImages(node);

        const canvas = await html2canvas(node, {
          scale: 3,
          backgroundColor: '#fff',
          useCORS: true,
          logging: false
        });

        if (!first) {
          pdf.addPage();
        }

        first = false;

        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          0,
          0,
          210,
          297,
          undefined,
          'FAST'
        );
      }

      if (!first) {
        pdf.save(
          `فرم-بدون-فاکتور-${header.date || 'بدون-تاریخ'}.pdf`
        );
      }
    } finally {
      setNoInvoiceBusy(false);
    }
  };

  const printAll = () => window.print();

  return (
    <div className="app-shell" dir="rtl">

      <aside className="control-panel no-print">

        <div className="panel-title">
          فرم صورت هزینه
        </div>

        <div className="panel-subtitle">
          نسخه طراحی‌شده برای چاپ A4
        </div>

        <div className="control-group">
          <label>تاریخ فرم</label>

          <input
            value={header.date}
            onChange={e =>
              updateDate(e.target.value)
            }
            placeholder="1405/  /  "
          />
        </div>

        <div className="control-grid">

          <div className="control-group">
            <label>کد سند</label>

            <input
              value={header.docCode}
              onChange={e =>
                updateHeader(
                  'docCode',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>کد سند مرجع</label>

            <input
              value={header.refCode}
              onChange={e =>
                updateHeader(
                  'refCode',
                  e.target.value
                )
              }
            />
          </div>

        </div>

        <div className="section-label">
          اطلاعات ۸ ردیف هزینه
        </div>

        <div className="editor-table">

          {rows.map((row, index) => (

            <div
              className="editor-row"
              key={index}
            >

              <span>
                {index + 1}
              </span>

              <input
                value={row.place}
                onChange={e =>
                  updateRow(
                    index,
                    'place',
                    e.target.value
                  )
                }
                placeholder="محل / شرکت"
              />

              <select
                value={row.service}
                onChange={e =>
                  updateRow(
                    index,
                    'service',
                    e.target.value
                  )
                }
              >
                <option value="">
                  نوع خدمات
                </option>

                {serviceOptions.map(option => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>

              <input
                className="description-input"
                value={row.description}
                onChange={e =>
                  updateRow(
                    index,
                    'description',
                    e.target.value
                  )
                }
                placeholder="شرح هزینه"
              />

              <input
                value={row.amount}
                onChange={e =>
                  updateRow(
                    index,
                    'amount',
                    e.target.value
                  )
                }
                inputMode="numeric"
                placeholder="مبلغ"
              />

            </div>

          ))}

        </div>

        <div className="section-label">
          امضاها
        </div>

        <div className="control-grid three">

          <div className="control-group">
            <label>تنظیم‌کننده</label>

            <input
              value={signatures.requester}
              onChange={e =>
                updateSignature(
                  'requester',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>تأییدکننده</label>

            <input
              value={signatures.confirmer}
              onChange={e =>
                updateSignature(
                  'confirmer',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>تصویب‌کننده</label>

            <input
              value={signatures.approver}
              onChange={e =>
                updateSignature(
                  'approver',
                  e.target.value
                )
              }
            />
          </div>

        </div>

        <div className="section-label">
          فرم بدون فاکتور
        </div>

        <div className="control-grid">

          <div className="control-group">
            <label>درخواست‌کننده</label>

            <input
              value={noInvoice.requester}
              onChange={e =>
                updateNoInvoice(
                  'requester',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>سمت</label>

            <input
              value={noInvoice.position}
              onChange={e =>
                updateNoInvoice(
                  'position',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>واحد / سازمان</label>

            <input
              value={noInvoice.organization}
              onChange={e =>
                updateNoInvoice(
                  'organization',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>
              علت عدم ارائه فاکتور
            </label>

            <input
              value={noInvoice.reason}
              onChange={e =>
                updateNoInvoice(
                  'reason',
                  e.target.value
                )
              }
            />
          </div>

        </div>

        <div className="action-grid">

          <button
            onClick={exportMainPdf}
            disabled={busy}
          >
            {busy
              ? 'در حال ساخت PDF...'
              : 'PDF فرم اصلی'}
          </button>

          <button
            onClick={exportNoInvoicePdf}
            disabled={
              noInvoiceBusy ||
              !noInvoiceForms.length
            }
          >
            {noInvoiceBusy
              ? 'در حال ساخت...'
              : `PDF بدون فاکتور (${noInvoiceForms.length})`}
          </button>

          <button onClick={printAll}>
            چاپ
          </button>

          <button
            className="secondary"
            onClick={reset}
          >
            پاک کردن اطلاعات
          </button>

        </div>

      </aside>

      <main className="preview-area">

        <div className="preview-note no-print">
          پیش‌نمایش واقعی فرم — A4 افقی
        </div>

        <section
          className="paper main-paper"
          id="main-print"
        >

          <div className="form-frame">

            <header className="main-header">

              <div className="header-codes">

                <div>
                  کد سند:
                  {' '}
                  <b>{header.docCode}</b>
                </div>

                <div>
                  کد سند مرجع:
                  {' '}
                  <b>{header.refCode}</b>
                </div>

                <div>
                  تاریخ:
                  {' '}
                  <b>{header.date}</b>
                </div>

              </div>

              <div className="header-title">
                {header.title}
              </div>

              <div className="header-logo">
                <img
                  src={LOGO_SRC}
                  alt="فاران"
                />
              </div>

            </header>

            <table className="expense-table">

              <colgroup>
                <col className="col-row" />
                <col className="col-date" />
                <col className="col-place" />
                <col className="col-service" />
                <col className="col-invoice" />
                <col className="col-description" />
                <col className="col-amount" />
              </colgroup>

              <thead>

                <tr>
                  <th>ردیف</th>
                  <th>تاریخ</th>
                  <th>محل مراجعه/بانک/شرکت</th>
                  <th>نوع خدمات</th>
                  <th>شماره قرارداد-فاکتور</th>
                  <th>شرح هزینه</th>
                  <th>مبلغ هزینه (ریال)</th>
                </tr>

              </thead>

              <tbody>

                {rows.map((row, index) => (

                  <tr key={index}>

                    <td>{index + 1}</td>

                    <td>
                      {row.date || header.date}
                    </td>

                    <td>
                      {row.place}
                    </td>

                    <td>
                      {row.service}
                    </td>

                    <td>
                      {row.invoice}
                    </td>

                    <td className="description-cell">
                      {row.description}
                    </td>

                    <td className="amount-cell">
                      {formatMoney(row.amount)}
                    </td>

                  </tr>

                ))}

                <tr className="total-row">

                  <td colSpan="5"></td>

                  <td className="total-label">
                    جمع کل هزینه:
                  </td>

                  <td className="amount-cell">
                    {formatMoney(total)}
                  </td>

                </tr>

              </tbody>

              <tfoot>

                <tr>
                  <td colSpan="7">
                    تاریخ واریز:
                    {' '}
                    ............................................................
                  </td>
                </tr>

              </tfoot>

            </table>

            <div className="signature-row">

              <div>
                <span>
                  نام و امضاء
                  <br />
                  تنظیم‌کننده:
                </span>

                <b>
                  {signatures.requester}
                </b>
              </div>

              <div>
                <span>
                  نام و امضاء
                  <br />
                  تأییدکننده:
                </span>

                <b>
                  {signatures.confirmer}
                </b>
              </div>

              <div>
                <span>
                  نام و امضاء
                  <br />
                  تصویب‌کننده:
                </span>

                <b>
                  {signatures.approver}
                </b>
              </div>

            </div>

          </div>

        </section>

        {noInvoiceForms.map(
          (items, pageIndex) => (

            <NoInvoiceForm
              key={pageIndex}
              items={items}
              pageIndex={pageIndex}
              noInvoice={noInvoice}
              header={header}
            />

          )
        )}

      </main>

    </div>
  );
}

function NoInvoiceForm({
  items,
  pageIndex,
  noInvoice,
  header
}) {

  const total = items.reduce(
    (sum, item) =>
      sum + numberValue(item.total),
    0
  );

  return (

    <section
      className="paper no-invoice-paper"
      id={`no-invoice-${pageIndex}`}
    >

      <div className="ni-frame">

        <header className="ni-top">

          <div className="ni-code-box">

            <div>
              کد فرم:
              {' '}
              <b>{noInvoice.formCode}</b>
            </div>

            <div>
              کد سند مرجع:
              {' '}
              <b>
                {noInvoice.refCode ||
                  header.refCode}
              </b>
            </div>

            <div>
              تاریخ:
              {' '}
              <b>{noInvoice.date}</b>
            </div>

          </div>

          <div className="ni-title">
            فرم صورت هزینه بدون فاکتور
          </div>

          <div className="ni-logo">
            <img
              src={LOGO_SRC}
              alt="فاران"
            />
          </div>

        </header>

        <div className="ni-fields">

          <div>
            <span>درخواست‌کننده:</span>
            <b>{noInvoice.requester}</b>
          </div>

          <div>
            <span>سمت:</span>
            <b>{noInvoice.position}</b>
          </div>

          <div>
            <span>واحد/سازمان:</span>
            <b>{noInvoice.organization}</b>
          </div>

          <div className="ni-reason">
            <span>
              علت عدم ارائه فاکتور:
            </span>
            <b>{noInvoice.reason}</b>
          </div>

        </div>

        <table className="ni-table">

          <colgroup>

            <col style={{ width: '8%' }} />

            <col style={{ width: '35%' }} />

            <col style={{ width: '25%' }} />

            <col style={{ width: '10%' }} />

            <col style={{ width: '22%' }} />

          </colgroup>

          <thead>

            <tr>
              <th>ردیف</th>
              <th>شرح هزینه</th>
              <th>محل / ارائه‌دهنده</th>
              <th>تعداد</th>
              <th>مبلغ (ریال)</th>
            </tr>

          </thead>

          <tbody>

            {[0, 1, 2].map(i => {

              const item = items[i];

              return (

                <tr key={i}>

                  <td>{i + 1}</td>

                  <td>
                    {item?.product || ''}
                  </td>

                  <td>
                    {item?.provider || ''}
                  </td>

                  <td>
                    {item?.qty || ''}
                  </td>

                  <td>
                    {item
                      ? formatMoney(item.total)
                      : ''}
                  </td>

                </tr>

              );

            })}

            <tr className="ni-total">

              <td colSpan="4">
                جمع کل:
              </td>

              <td>
                {formatMoney(total)}
              </td>

            </tr>

          </tbody>

        </table>

        <div className="ni-signatures">

          <div>
            تنظیم‌کننده:
            {' '}
            <b>{noInvoice.requester}</b>
            <span>امضاء:</span>
          </div>

          <div>
            تأییدکننده:
            <span>امضاء:</span>
          </div>

          <div>
            تصویب‌کننده:
            <span>امضاء:</span>
          </div>

        </div>

      </div>

    </section>

  );
}

createRoot(
  document.getElementById('root')
).render(<App />);
