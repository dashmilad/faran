import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

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
  'اتوبوس'
];

/* =========================================================
   توابع تقویم شمسی
========================================================= */

function div(a, b) {
  return Math.floor(a / b);
}

function mod(a, b) {
  return a - Math.floor(a / b) * b;
}

// تبدیل تاریخ میلادی به جلالی
function gregorianToJalali(gy, gm, gd) {
  const gdm = [
    0,
    31,
    59,
    90,
    120,
    151,
    181,
    212,
    243,
    273,
    304,
    334
  ];

  let jy;

  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }

  const gy2 = gm > 2 ? gy + 1 : gy;

  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    gdm[gm - 1];

  jy += 33 * div(days, 12053);
  days = mod(days, 12053);

  jy += 4 * div(days, 1461);
  days = mod(days, 1461);

  if (days > 365) {
    jy += div(days - 1, 365);
    days = mod(days - 1, 365);
  }

  const jm =
    days < 186
      ? 1 + div(days, 31)
      : 7 + div(days - 186, 30);

  const jd =
    1 +
    (days < 186
      ? mod(days, 31)
      : mod(days - 186, 30));

  return [jy, jm, jd];
}

// تبدیل تاریخ جلالی به میلادی
function jalaliToGregorian(jy, jm, jd) {
  let gy;

  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }

  const days =
    365 * jy +
    div(jy, 33) * 8 +
    div(mod(jy, 33) + 3, 4) +
    78 +
    jd +
    (jm < 7
      ? (jm - 1) * 31
      : (jm - 7) * 30 + 186);

  gy += 400 * div(days, 146097);

  let d = mod(days, 146097);

  if (d > 36524) {
    gy += 100 * div(--d, 36524);
    d = mod(d, 36524);

    if (d >= 365) {
      d++;
    }
  }

  gy += 4 * div(d, 1461);
  d = mod(d, 1461);

  if (d > 365) {
    gy += div(d - 1, 365);
    d = mod(d - 1, 365);
  }

  const gd = d + 1;

  const leap =
    (gy % 4 === 0 && gy % 100 !== 0) ||
    gy % 400 === 0;

  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  let gm = 1;
  let day = gd;

  for (let i = 0; i < monthDays.length; i++) {
    if (day <= monthDays[i]) {
      gm = i + 1;
      break;
    }

    day -= monthDays[i];
  }

  return [gy, gm, day];
}

function getJalaliToday() {
  const now = new Date();

  const [jy, jm, jd] = gregorianToJalali(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );

  return {
    year: jy,
    month: jm,
    day: jd
  };
}

function formatJalaliDate(year, month, day) {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

const jalaliMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

const weekDays = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه'
];

function getMonthDays(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;

  // تعیین 29 یا 30 روزه بودن اسفند
  const [gy] = jalaliToGregorian(year, 12, 1);
  const [gyNext] = jalaliToGregorian(year + 1, 1, 1);

  const start = new Date(gy, 2, 19);
  const next = new Date(gyNext, 2, 19);

  const diff =
    Math.round(
      (next.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    );

  return diff > 365 ? 30 : 29;
}

function getFirstWeekday(year, month) {
  const [gy, gm, gd] = jalaliToGregorian(
    year,
    month,
    1
  );

  const date = new Date(gy, gm - 1, gd);

  // JS: Sunday=0 ... Saturday=6
  // تقویم ما: Saturday=0 ... Friday=6
  return (date.getDay() + 1) % 7;
}

/* =========================================================
   تقویم شمسی
========================================================= */

function PersianDatePicker({ value, onChange }) {
  const today = getJalaliToday();

  const [open, setOpen] = useState(false);

  const parseValue = value => {
    const match = String(value || '').match(
      /^(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})$/
    );

    if (!match) {
      return {
        year: today.year,
        month: today.month,
        day: today.day
      };
    }

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  };

  const selected = parseValue(value);

  const [viewYear, setViewYear] = useState(
    selected.year
  );

  const [viewMonth, setViewMonth] = useState(
    selected.month
  );

  const daysInMonth = getMonthDays(
    viewYear,
    viewMonth
  );

  const firstDay = getFirstWeekday(
    viewYear,
    viewMonth
  );

  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  const previousMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const selectDay = day => {
    if (!day) return;

    const formatted = formatJalaliDate(
      viewYear,
      viewMonth,
      day
    );

    onChange(formatted);
    setOpen(false);
  };

  const goToday = () => {
    setViewYear(today.year);
    setViewMonth(today.month);

    onChange(
      formatJalaliDate(
        today.year,
        today.month,
        today.day
      )
    );

    setOpen(false);
  };

  return (
    <div
      className="jalali-picker"
      style={{
        position: 'relative',
        width: '100%'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%'
        }}
      >
        <input
          value={value}
          readOnly
          onClick={() => {
            setViewYear(selected.year);
            setViewMonth(selected.month);
            setOpen(prev => !prev);
          }}
          placeholder="انتخاب تاریخ"
          style={{
            cursor: 'pointer',
            paddingLeft: '38px'
          }}
        />

        <button
          type="button"
          onClick={() => {
            setViewYear(selected.year);
            setViewMonth(selected.month);
            setOpen(prev => !prev);
          }}
          aria-label="باز کردن تقویم"
          style={{
            position: 'absolute',
            left: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '28px',
            height: '28px',
            border: '0',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '17px',
            padding: 0
          }}
        >
          📅
        </button>
      </div>

      {open && (
        <div
          className="jalali-calendar"
          style={{
            position: 'absolute',
            top: 'calc(100% + 7px)',
            right: 0,
            width: '300px',
            background: '#fff',
            border: '1px solid #d5dae0',
            borderRadius: '12px',
            boxShadow:
              '0 12px 35px rgba(0,0,0,.18)',
            padding: '12px',
            zIndex: 9999,
            direction: 'rtl'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}
          >
            <button
              type="button"
              onClick={nextMonth}
              style={{
                border: '0',
                background: '#f1f3f5',
                borderRadius: '7px',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ‹
            </button>

            <strong
              style={{
                fontSize: '14px'
              }}
            >
              {jalaliMonths[viewMonth - 1]}{' '}
              {viewYear}
            </strong>

            <button
              type="button"
              onClick={previousMonth}
              style={{
                border: '0',
                background: '#f1f3f5',
                borderRadius: '7px',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ›
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(7, 1fr)',
              gap: '3px',
              marginBottom: '5px'
            }}
          >
            {weekDays.map(day => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#69717c',
                  padding: '4px 0'
                }}
              >
                {day.slice(0, 1)}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(7, 1fr)',
              gap: '3px'
            }}
          >
            {days.map((day, index) => {
              const isSelected =
                day === selected.day &&
                viewMonth === selected.month &&
                viewYear === selected.year;

              const isToday =
                day === today.day &&
                viewMonth === today.month &&
                viewYear === today.year;

              return (
                <button
                  type="button"
                  key={`${viewYear}-${viewMonth}-${index}`}
                  disabled={!day}
                  onClick={() => selectDay(day)}
                  style={{
                    height: '32px',
                    border: isSelected
                      ? '1px solid #20252b'
                      : isToday
                      ? '1px solid #8b939c'
                      : '1px solid transparent',
                    borderRadius: '7px',
                    background: isSelected
                      ? '#20252b'
                      : isToday
                      ? '#eef0f2'
                      : '#fff',
                    color: isSelected
                      ? '#fff'
                      : '#222',
                    cursor: day
                      ? 'pointer'
                      : 'default',
                    fontSize: '11px',
                    fontWeight:
                      isSelected || isToday
                        ? 700
                        : 400
                  }}
                >
                  {day || ''}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={goToday}
            style={{
              width: '100%',
              height: '32px',
              marginTop: '9px',
              border: '0',
              borderRadius: '7px',
              background: '#eef0f2',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            امروز
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   توابع عمومی
========================================================= */

function numberValue(value) {
  return (
    Number(
      String(value ?? '').replace(
        /[٬,،\s]/g,
        ''
      )
    ) || 0
  );
}

function formatMoney(value) {
  const n = numberValue(value);

  return n
    ? new Intl.NumberFormat('fa-IR').format(n)
    : '';
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

/* =========================================================
   App
========================================================= */

function App() {
  const [header, setHeader] = useState({
    title:
      'فرم صورت ریز هزینه های تنخواه واحد خدمات',
    docCode: 'FI-B-FO-112/00',
    refCode: 'FI-B-RE-001/00',
    date: '1405/  /  '
  });

  const [rows, setRows] =
    useState(initialRows);

  const [signatures, setSignatures] =
    useState({
      requester: '',
      confirmer: '',
      approver: ''
    });

  const [noInvoice, setNoInvoice] =
    useState({
      formCode: 'FI-B-FO-135/00',
      refCode: 'FI-B-RE-001/00',
      date: '1405/  /  ',
      requester: '',
      position: '',
      organization: '',
      reason: '',
      notes: ''
    });

  const [busy, setBusy] =
    useState(false);

  const [noInvoiceBusy, setNoInvoiceBusy] =
    useState(false);

  const total = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum + numberValue(row.amount),
        0
      ),
    [rows]
  );

  /*
   * فرم بدون فاکتور فقط از روی شرح هزینه ساخته می‌شود.
   * نوع خدمات هیچ نقشی در این قسمت ندارد.
   */
  const noInvoiceItems = useMemo(() => {
    const items = [];

    rows.forEach(row => {
      const description = String(
        row.description || ''
      ).trim();

      const amount = numberValue(
        row.amount
      );

      if (!description || amount <= 0)
        return;

      const matchedKeywords =
        extractNoInvoiceItems(
          description
        );

      matchedKeywords.forEach(keyword => {
        items.push({
          product: keyword,
          provider: row.place,
          date:
            row.date || header.date,
          qty: '1',
          unitAmount:
            String(amount),
          total:
            String(amount)
        });
      });
    });

    return items;
  }, [rows, header.date]);

  const noInvoiceForms = useMemo(
    () =>
      chunk(
        noInvoiceItems,
        3
      ),
    [noInvoiceItems]
  );

  const updateHeader = (
    key,
    value
  ) =>
    setHeader(prev => ({
      ...prev,
      [key]: value
    }));

  /*
   * با انتخاب تاریخ:
   * 1- تاریخ سربرگ
   * 2- تاریخ تمام ردیف‌ها
   * 3- تاریخ فرم بدون فاکتور
   * همزمان تغییر می‌کنند.
   */
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

  const updateRow = (
    index,
    key,
    value
  ) => {
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

  const updateSignature = (
    key,
    value
  ) =>
    setSignatures(prev => ({
      ...prev,
      [key]: value
    }));

  const updateNoInvoice = (
    key,
    value
  ) =>
    setNoInvoice(prev => ({
      ...prev,
      [key]: value
    }));

  const reset = () => {
    setRows(
      Array.from(
        { length: 8 },
        () =>
          emptyRow(header.date)
      )
    );

    setSignatures({
      requester: '',
      confirmer: '',
      approver: ''
    });

    setNoInvoice({
      formCode:
        'FI-B-FO-135/00',
      refCode:
        header.refCode,
      date:
        header.date,
      requester: '',
      position: '',
      organization: '',
      reason: '',
      notes: ''
    });
  };

  const waitForImages = async node => {
    const images = [
      ...node.querySelectorAll('img')
    ];

    await Promise.all(
      images.map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(
              resolve => {
                img.onload =
                  resolve;
                img.onerror =
                  resolve;
              }
            )
      )
    );
  };

  const exportMainPdf = async () => {
    const node =
      document.getElementById(
        'main-print'
      );

    if (!node) return;

    setBusy(true);

    try {
      await waitForImages(node);

      const canvas =
        await html2canvas(node, {
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
        canvas.toDataURL(
          'image/png'
        ),
        'PNG',
        0,
        0,
        297,
        210,
        undefined,
        'FAST'
      );

      pdf.save(
        `فرم-تنخواه-${
          header.date ||
          'بدون-تاریخ'
        }.pdf`
      );
    } finally {
      setBusy(false);
    }
  };

  const exportNoInvoicePdf =
    async () => {
      if (!noInvoiceForms.length)
        return;

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
          const node =
            document.getElementById(
              `no-invoice-${i}`
            );

          if (!node) continue;

          await waitForImages(
            node
          );

          const canvas =
            await html2canvas(
              node,
              {
                scale: 3,
                backgroundColor:
                  '#fff',
                useCORS: true,
                logging: false
              }
            );

          if (!first) {
            pdf.addPage();
          }

          first = false;

          pdf.addImage(
            canvas.toDataURL(
              'image/png'
            ),
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
            `فرم-بدون-فاکتور-${
              header.date ||
              'بدون-تاریخ'
            }.pdf`
          );
        }
      } finally {
        setNoInvoiceBusy(false);
      }
    };

  const printAll = () =>
    window.print();

  return (
    <div
      className="app-shell"
      dir="rtl"
    >
      <aside className="control-panel no-print">

        <div className="panel-title">
          فرم صورت هزینه
        </div>

        <div className="panel-subtitle">
          نسخه طراحی‌شده برای چاپ A4
        </div>

        {/* تاریخ فرم */}
        <div className="control-group">
          <label>تاریخ فرم</label>

          <PersianDatePicker
            value={header.date}
            onChange={updateDate}
          />
        </div>

        <div className="control-grid">

          <div className="control-group">
            <label>
              کد سند
            </label>

            <input
              value={
                header.docCode
              }
              onChange={e =>
                updateHeader(
                  'docCode',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>
              کد سند مرجع
            </label>

            <input
              value={
                header.refCode
              }
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

          {rows.map(
            (row, index) => (

              <div
                className="editor-row"
                key={index}
              >

                <span>
                  {index + 1}
                </span>

                <input
                  value={
                    row.place
                  }
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
                  value={
                    row.service
                  }
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

                  {serviceOptions.map(
                    option => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>

                <input
                  className="description-input"
                  value={
                    row.description
                  }
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
                  value={
                    row.amount
                  }
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

            )
          )}

        </div>

        <div className="section-label">
          امضاها
        </div>

        <div className="control-grid three">

          <div className="control-group">
            <label>
              تنظیم‌کننده
            </label>

            <input
              value={
                signatures.requester
              }
              onChange={e =>
                updateSignature(
                  'requester',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>
              تأییدکننده
            </label>

            <input
              value={
                signatures.confirmer
              }
              onChange={e =>
                updateSignature(
                  'confirmer',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>
              تصویب‌کننده
            </label>

            <input
              value={
                signatures.approver
              }
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
            <label>
              درخواست‌کننده
            </label>

            <input
              value={
                noInvoice.requester
              }
              onChange={e =>
                updateNoInvoice(
                  'requester',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>
              سمت
            </label>

            <input
              value={
                noInvoice.position
              }
              onChange={e =>
                updateNoInvoice(
                  'position',
                  e.target.value
                )
              }
            />
          </div>

          <div className="control-group">
            <label>
              واحد / سازمان
            </label>

            <input
              value={
                noInvoice.organization
              }
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
              value={
                noInvoice.reason
              }
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
            onClick={
              exportMainPdf
            }
            disabled={busy}
          >
            {busy
              ? 'در حال ساخت PDF...'
              : 'PDF فرم اصلی'}
          </button>

          <button
            onClick={
              exportNoInvoicePdf
            }
            disabled={
              noInvoiceBusy ||
              !noInvoiceForms.length
            }
          >
            {noInvoiceBusy
              ? 'در حال ساخت...'
              : `PDF بدون فاکتور (${noInvoiceForms.length})`}
          </button>

          <button
            onClick={printAll}
          >
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
                  <b>
                    {header.docCode}
                  </b>
                </div>

                <div>
                  کد سند مرجع:
                  {' '}
                  <b>
                    {header.refCode}
                  </b>
                </div>

                <div>
                  تاریخ:
                  {' '}
                  <b>
                    {header.date}
                  </b>
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
                  <th>
                    محل مراجعه/بانک/شرکت
                  </th>
                  <th>
                    نوع خدمات
                  </th>
                  <th>
                    شماره قرارداد-فاکتور
                  </th>
                  <th>
                    شرح هزینه
                  </th>
                  <th>
                    مبلغ هزینه (ریال)
                  </th>
                </tr>

              </thead>

              <tbody>

                {rows.map(
                  (row, index) => (

                    <tr key={index}>

                      <td>
                        {index + 1}
                      </td>

                      <td>
                        {row.date ||
                          header.date}
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
                        {formatMoney(
                          row.amount
                        )}
                      </td>

                    </tr>

                  )
                )}

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
                  {
                    signatures.requester
                  }
                </b>
              </div>

              <div>
                <span>
                  نام و امضاء
                  <br />
                  تأییدکننده:
                </span>

                <b>
                  {
                    signatures.confirmer
                  }
                </b>
              </div>

              <div>
                <span>
                  نام و امضاء
                  <br />
                  تصویب‌کننده:
                </span>

                <b>
                  {
                    signatures.approver
                  }
                </b>
              </div>

            </div>

          </div>

        </section>

        {noInvoiceForms.map(
          (
            items,
            pageIndex
          ) => (

            <NoInvoiceForm
              key={pageIndex}
              items={items}
              pageIndex={
                pageIndex
              }
              noInvoice={
                noInvoice
              }
              header={header}
            />

          )
        )}

      </main>

    </div>
  );
}

/* =========================================================
   فرم بدون فاکتور
========================================================= */

function NoInvoiceForm({
  items,
  pageIndex,
  noInvoice,
  header
}) {
  const total =
    items.reduce(
      (sum, item) =>
        sum +
        numberValue(
          item.total
        ),
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
              <b>
                {
                  noInvoice.formCode
                }
              </b>
            </div>

            <div>
              کد سند مرجع:
              {' '}
              <b>
                {
                  noInvoice.refCode ||
                  header.refCode
                }
              </b>
            </div>

            <div>
              تاریخ:
              {' '}
              <b>
                {
                  noInvoice.date
                }
              </b>
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
            <span>
              درخواست‌کننده:
            </span>

            <b>
              {
                noInvoice.requester
              }
            </b>
          </div>

          <div>
            <span>
              سمت:
            </span>

            <b>
              {
                noInvoice.position
              }
            </b>
          </div>

          <div>
            <span>
              واحد/سازمان:
            </span>

            <b>
              {
                noInvoice.organization
              }
            </b>
          </div>

          <div className="ni-reason">
            <span>
              علت عدم ارائه فاکتور:
            </span>

            <b>
              {
                noInvoice.reason
              }
            </b>
          </div>

        </div>

        <table className="ni-table">

          <colgroup>

            <col
              style={{
                width: '8%'
              }}
            />

            <col
              style={{
                width: '35%'
              }}
            />

            <col
              style={{
                width: '25%'
              }}
            />

            <col
              style={{
                width: '10%'
              }}
            />

            <col
              style={{
                width: '22%'
              }}
            />

          </colgroup>

          <thead>

            <tr>
              <th>ردیف</th>
              <th>شرح هزینه</th>
              <th>
                محل / ارائه‌دهنده
              </th>
              <th>تعداد</th>
              <th>
                مبلغ (ریال)
              </th>
            </tr>

          </thead>

          <tbody>

            {[0, 1, 2].map(i => {

              const item =
                items[i];

              return (
                <tr key={i}>

                  <td>
                    {i + 1}
                  </td>

                  <td>
                    {item?.product ||
                      ''}
                  </td>

                  <td>
                    {item?.provider ||
                      ''}
                  </td>

                  <td>
                    {item?.qty ||
                      ''}
                  </td>

                  <td>
                    {item
                      ? formatMoney(
                          item.total
                        )
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
            <b>
              {
                noInvoice.requester
              }
            </b>

            <span>
              امضاء:
            </span>
          </div>

          <div>
            تأییدکننده:
            <span>
              امضاء:
            </span>
          </div>

          <div>
            تصویب‌کننده:
            <span>
              امضاء:
            </span>
          </div>

        </div>

      </div>

    </section>
  );
}

createRoot(
  document.getElementById('root')
).render(
  <App />
);
