import { LeadgenDashboard } from "@/components/leadgen/leadgen-dashboard";

export default function LeadgenPage() {
  return (
    <main className="leadgen-app">
      <header className="leadgen-product-header">
        <div>
          <span className="leadgen-product-name">Leadgen Client</span>
          <h1>Поиск и подготовка лидов</h1>
          <p>
            Находит компании по реальным коммерческим сигналам, определяет ЛПР,
            ищет рабочий email и подготавливает персонализированное первое касание.
          </p>
        </div>
        <div className="leadgen-pipeline" aria-label="Процесс Leadgen OS">
          <span>Компания</span><i>→</i><span>Сигнал</span><i>→</i><span>ЛПР</span>
          <i>→</i><span>Email</span><i>→</i><span>Письмо</span><i>→</i><span>Отправка</span>
        </div>
      </header>
      <nav className="client-nav" aria-label="Основная навигация">
        <a href="#icp">1. ICP</a><a href="#new-search">2. Новый поиск</a>
        <a href="#leads">3. Лиды</a><a href="#letters">4. Письма</a>
        <a href="#followups">5. Дожимы</a><a href="#history">6. История</a>
        <form action="/api/auth/logout" method="post"><button type="submit">Выйти</button></form>
      </nav>
      <LeadgenDashboard />
    </main>
  );
}
