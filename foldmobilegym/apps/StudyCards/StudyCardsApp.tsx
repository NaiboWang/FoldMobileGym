import React from "react";
import './study-cards-adaptive.css';
import { ArrowLeft, BookOpen, Plus, Save } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { useAppNavigationHandler } from "../../os/hooks/useAppNavigationHandler";
import { useStudyCardsStore } from "./state";
import { useAppStrings } from "../../os/useAppStrings";
import { IcLauncher } from "./res/icons";
import { strings } from "./res/strings";
import { stringsEn } from "./res/strings.en";
const styles = `
.cards-root{height:100%;container-type:inline-size;background:#f6f7fb;color:#2e3856;font-family:Inter,"Microsoft YaHei",sans-serif}.cards-layout{height:100%;display:grid;grid-template-columns:1fr;overflow:hidden}.decks{background:#fff;display:flex;flex-direction:column;overflow:hidden}.cards-head{padding:20px 17px 12px;display:flex;align-items:center;gap:10px}.cards-head i{width:41px;height:41px;display:grid;place-items:center}.cards-head i svg{width:41px;height:41px}.cards-head h1{font-size:22px;margin:0}.deck-list{padding:0 10px}.deck{width:100%;border:0;background:transparent;border-radius:10px;padding:13px 10px;display:flex;align-items:center;gap:10px;text-align:left;color:inherit}.deck.active{background:#edefff;color:#4255ff}.deck span{display:flex;flex:1;flex-direction:column}.deck small{color:#586380}.new-card{margin:auto 15px 18px;border:0;border-radius:10px;background:#4255ff;color:#fff;padding:12px;display:flex;justify-content:center;gap:7px;font-weight:700}.cards-panel{display:none;background:#f6f7fb;height:100%;overflow:hidden}.cards-panel.show{display:flex;flex-direction:column}.cards-panel header{height:62px;border-bottom:1px solid #d9dde8;background:#fff;padding:0 14px;display:flex;gap:9px;align-items:center}.cards-panel header button{border:0;background:transparent}.cards-form{padding:22px 18px;overflow:auto;flex:1}.cards-form label{display:flex;flex-direction:column;gap:7px;margin-bottom:18px;font-weight:600}.cards-form input,.cards-form textarea,.cards-form select{border:0;border-bottom:3px solid #2e3856;border-radius:4px;padding:12px;background:#fff;font:inherit}.cards-form input:focus,.cards-form textarea:focus,.cards-form select:focus{outline:none;border-bottom-color:#4255ff}.cards-form textarea{min-height:140px}.cards-save{margin:12px 18px 18px;border:0;border-radius:10px;background:#4255ff;color:#fff;padding:12px;display:flex;justify-content:center;gap:8px;font-weight:700}.cards-save:disabled{opacity:.4}.card-list{padding:22px;overflow:auto}.flashcard{border:0;border-radius:10px;padding:17px;margin-bottom:12px;background:#fff;box-shadow:0 2px 10px rgba(46,56,86,.08)}.flashcard b{font-size:18px}.flashcard p{color:#586380;line-height:1.6}.cards-empty{display:none}
@container(min-width:600px){.cards-layout{grid-template-columns:310px minmax(0,1fr)}.decks{border-right:1px solid #d9dde8}.cards-panel,.cards-empty{display:flex}.cards-empty{align-items:center;justify-content:center;flex-direction:column;color:#586380}.cards-panel header button{display:none}}
@container(max-width:599px){.cards-layout.form .decks{display:none}.cards-panel{display:flex}}
`;
const Content: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const decks = useStudyCardsStore((s) => s.decks);
  const cards = useStudyCardsStore((s) => s.cards);
  const selected = useStudyCardsStore((s) => s.selectedDeckId);
  const form = useStudyCardsStore((s) => s.formOpen);
  const draft = useStudyCardsStore((s) => s.draft);
  const select = useStudyCardsStore((s) => s.selectDeck);
  const begin = useStudyCardsStore((s) => s.beginCard);
  const update = useStudyCardsStore((s) => s.updateDraft);
  const cancel = useStudyCardsStore((s) => s.cancelCard);
  const save = useStudyCardsStore((s) => s.saveCard);
  useAppNavigationHandler("study_cards", {
    onBack: () => {
      if (!form) return false;
      cancel();
      return true;
    },
  });
  return (
    <div className="cards-root">
      <style>{styles}</style>
      <div className={form ? "cards-layout form" : "cards-layout"}>
        <section className="decks">
          <div className="cards-head">
            <i>
              <IcLauncher />
            </i>
            <h1>{s.app_name}</h1>
          </div>
          <div className="deck-list">
            {decks.map((d) => (
              <button
                key={d.id}
                data-action="cards.deck.open"
                data-action-params={JSON.stringify({ id: d.id })}
                className={d.id === selected ? "deck active" : "deck"}
                onClick={() => select(d.id)}
              >
                <BookOpen />
                <span>
                  <b>{d.name}</b>
                  <small>
                    {cards.filter((c) => c.deckId === d.id).length}{" "}
                    {s.card_count_unit}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button
            data-action="cards.form.open"
            className="new-card"
            onClick={begin}
          >
            <Plus />
            {s.create_card}
          </button>
        </section>
        {form ? (
          <section
            className="cards-panel show"
            data-benchmark-route="card-form"
          >
            <header>
              <button onClick={cancel}>
                <ArrowLeft />
              </button>
              <b>{s.create_card_title}</b>
            </header>
            <main className="cards-form">
              <label>
                <span>{s.study_set}</span>
                <select
                  value={draft.deckId}
                  onChange={(e) => update({ deckId: e.target.value })}
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{s.term}</span>
                <input
                  data-action="cards.form.front.input"
                  data-benchmark-field="card-front"
                  value={draft.front}
                  onChange={(e) => update({ front: e.target.value })}
                />
              </label>
              <label>
                <span>{s.definition}</span>
                <textarea
                  data-action="cards.form.back.input"
                  data-benchmark-field="card-back"
                  value={draft.back}
                  onChange={(e) => update({ back: e.target.value })}
                />
              </label>
            </main>
            <button
              data-action="cards.form.save"
              data-benchmark-action="save-card"
              data-keep-keyboard
              className="cards-save"
              disabled={!draft.front.trim() || !draft.back.trim()}
              onClick={save}
            >
              <Save size={18} />
              {s.save_card}
            </button>
          </section>
        ) : (
          <section className="card-list">
            {cards
              .filter((c) => c.deckId === selected)
              .map((c) => (
                <article className="flashcard" key={c.id}>
                  <b>{c.front}</b>
                  <p>{c.back}</p>
                </article>
              ))}
          </section>
        )}
      </div>
    </div>
  );
};
const StudyCardsApp: React.FC = () => (
  <div className="h-full w-full pt-10" data-status-bar-foreground="dark">
    <MemoryRouter>
      <Content />
    </MemoryRouter>
  </div>
);
export default StudyCardsApp;
