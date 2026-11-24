import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-left">
          <span
            className="site-footer-age-badge"
            title="Информационная продукция для лиц старше 18 лет (436-ФЗ)"
          >
            18+
          </span>
          <span className="site-footer-notice">
            Закрытый некоммерческий клуб. Доступ предоставляется только одобренным участникам.
          </span>
        </div>

        <div className="site-footer-links">
          <Link to="/privacy" className="site-footer-link-btn">
            Политика обработки персональных данных (152-ФЗ)
          </Link>
          <Link to="/terms" className="site-footer-link-btn">
            Пользовательское соглашение
          </Link>
          <Link to="/copyright" className="site-footer-link-btn">
            Правообладателям (ст. 1253.1 ГК РФ)
          </Link>
        </div>
      </div>
    </footer>
  );
}