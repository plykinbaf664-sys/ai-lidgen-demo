import { LeadgenDashboard } from "@/components/leadgen/leadgen-dashboard";

export default function LeadgenPage() {
  return (
    <main className="leadgen-app">
      <header className="leadgen-product-header">
        <div aria-hidden="true" className="leadgen-header-ambient" />
        <div className="leadgen-header-copy">
          <div className="leadgen-brand-row">
            <span className="leadgen-product-name">Leadgen Client</span>
            <span className="leadgen-system-state"><i />Контур готов</span>
          </div>
          <h1>Поиск и подготовка лидов</h1>
          <p>
            Находит компании по реальным коммерческим сигналам, определяет ЛПР,
            ищет рабочий email и подготавливает персонализированное первое касание.
          </p>
        </div>
        <div className="leadgen-pipeline-shell">
          <span className="leadgen-pipeline-label">От сигнала до касания</span>
          <div className="leadgen-pipeline" aria-label="Процесс Leadgen OS">
            <span>Компания</span><i>→</i><span>Сигнал</span><i>→</i><span>ЛПР</span>
            <i>→</i><span>Email</span><i>→</i><span>Письмо</span><i>→</i><span>Отправка</span>
          </div>
        </div>
      </header>
      <nav className="client-nav" aria-label="Основная навигация">
        <a href="#icp"><span>01</span>ICP</a><a href="#new-search"><span>02</span>Новый поиск</a>
        <a href="#leads"><span>03</span>Лиды</a><a href="#letters"><span>04</span>Письма</a>
        <a href="#followups"><span>05</span>Дожимы</a><a href="#history"><span>06</span>История</a>
        <form action="/api/auth/logout" method="post"><button type="submit">Выйти <span aria-hidden="true">↗</span></button></form>
      </nav>
      <LeadgenDashboard />
    </main>
  );
}
