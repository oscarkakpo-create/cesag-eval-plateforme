css_to_add = """
/* ============================================================ */
/* LANDING PAGE / ACCUEIL PROGRAMMATION                         */
/* ============================================================ */
.landing-hero {
  background: linear-gradient(135deg, #0B4D2E 0%, #07351F 100%);
  border-radius: var(--radius);
  padding: 34px 34px 38px;
  color: #ffffff;
  box-shadow: 0 10px 28px rgba(7, 53, 31, 0.16);
  border: 1px solid rgba(201, 150, 42, 0.35);
  position: relative;
  overflow: hidden;
  margin-bottom: 26px;
}
.landing-hero::after {
  content: "CESAG";
  position: absolute;
  right: -20px;
  bottom: -40px;
  font-size: 160px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.03);
  pointer-events: none;
}
.hero-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(201, 150, 42, 0.2);
  border: 1px solid rgba(201, 150, 42, 0.6);
  color: #F5D58B;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.landing-hero h2 {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.25;
  margin: 0 0 12px 0;
  color: #ffffff;
}
.landing-hero p {
  font-size: 15px;
  line-height: 1.6;
  color: #DCEFE3;
  max-width: 920px;
  margin: 0;
}
.landing-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 26px;
}
.landing-card {
  background: #ffffff;
  border: 1px solid var(--cesag-border);
  border-radius: var(--radius);
  padding: 24px;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: var(--shadow);
  position: relative;
}
.landing-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(11, 77, 46, 0.12);
  border-color: var(--cesag-gold);
}
.landing-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.landing-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--cesag-green-soft);
  color: var(--cesag-green);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.landing-card.highlight .landing-card-icon {
  background: var(--cesag-gold-bg);
  color: var(--cesag-gold);
}
.landing-card-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--cesag-green-soft);
  color: var(--cesag-green);
}
.landing-card.highlight .landing-card-badge {
  background: var(--cesag-gold-bg);
  color: #925C03;
}
.landing-card-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--cesag-green-dark);
  margin: 0 0 8px 0;
}
.landing-card-desc {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 18px 0;
  flex-grow: 1;
}
.landing-card-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.landing-workflow-card {
  background: #ffffff;
  border: 1px solid var(--cesag-border);
  border-radius: var(--radius);
  padding: 26px 30px;
  box-shadow: var(--shadow);
  margin-bottom: 26px;
}
.landing-workflow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--cesag-border);
}
.landing-workflow-header h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--cesag-green-dark);
  margin: 0;
}
.landing-steps-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}
.landing-step-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.landing-step-num {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--cesag-green);
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(11, 77, 46, 0.2);
}
.landing-step-num.gold {
  background: var(--cesag-gold);
  box-shadow: 0 4px 10px rgba(201, 150, 42, 0.3);
}
.landing-step-num.dark {
  background: var(--cesag-green-dark);
}
.landing-step-body h4 {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--cesag-green-dark);
  margin: 0 0 4px 0;
}
.landing-step-body p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
  margin: 0;
}
.landing-stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  background: var(--cesag-green-soft);
  border: 1px solid var(--cesag-border-strong);
  border-radius: var(--radius);
  padding: 18px 22px;
}
.landing-stat-box {
  text-align: center;
}
.landing-stat-val {
  font-size: 24px;
  font-weight: 800;
  color: var(--cesag-green-dark);
  line-height: 1.1;
}
.landing-stat-lbl {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--cesag-green);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
@media (max-width: 900px) {
  .landing-cards-grid,
  .landing-steps-row,
  .landing-stats-strip {
    grid-template-columns: 1fr;
  }
}
"""
css_path = r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\public\css\style.css"
with open(css_path, "a", encoding="utf-8") as f:
    f.write(css_to_add)
print("Landing styles appended successfully!")
