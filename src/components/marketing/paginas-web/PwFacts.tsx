import type { PaginasWebFact } from "@/pages/marketing/paginasWebContent";

interface PwFactsProps {
  facts: readonly PaginasWebFact[];
  /** En columna (junto a otro bloque) en lugar de en franja horizontal. */
  stack?: boolean;
}

/** Franja de datos: valor grande y una línea que lo explica. */
const PwFacts = ({ facts, stack }: PwFactsProps) => (
  <ul role="list" className={stack ? "ms-pw-facts ms-pw-facts--stack" : "ms-pw-facts"}>
    {facts.map((fact) => (
      <li key={`${fact.value}|${fact.label}`} className="ms-pw-fact">
        <span className="ms-pw-fact__value">{fact.value}</span>
        <span className="ms-pw-fact__label">{fact.label}</span>
      </li>
    ))}
  </ul>
);

export default PwFacts;
