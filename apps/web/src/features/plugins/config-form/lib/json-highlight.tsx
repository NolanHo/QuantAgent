type JsonTokenType =
  | "boolean"
  | "key"
  | "null"
  | "number"
  | "plain"
  | "punctuation"
  | "string";

export function renderHighlightedJson(source: string) {
  return source.split("\n").map((line, lineIndex, lines) => (
    <span key={`json-line-${lineIndex}`} className="block">
      {tokenizeJsonLine(line).map((token, tokenIndex) => (
        <span
          key={`json-token-${lineIndex}-${tokenIndex}`}
          className={jsonTokenClassName(token.type)}
        >
          {token.text}
        </span>
      ))}
      {lineIndex < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

function tokenizeJsonLine(line: string) {
  const tokens: Array<{ text: string; type: JsonTokenType }> = [];
  let index = 0;

  while (index < line.length) {
    const current = line[index];

    if (/\s/.test(current)) {
      let end = index + 1;
      while (end < line.length && /\s/.test(line[end])) {
        end += 1;
      }
      tokens.push({ text: line.slice(index, end), type: "plain" });
      index = end;
      continue;
    }

    if (current === '"') {
      let end = index + 1;

      while (end < line.length) {
        if (line[end] === "\\" && end + 1 < line.length) {
          end += 2;
          continue;
        }
        if (line[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }

      const text = line.slice(index, end);
      let lookahead = end;
      while (lookahead < line.length && /\s/.test(line[lookahead])) {
        lookahead += 1;
      }

      tokens.push({
        text,
        type: line[lookahead] === ":" ? "key" : "string",
      });
      index = end;
      continue;
    }

    if ("{}[],:".includes(current)) {
      tokens.push({ text: current, type: "punctuation" });
      index += 1;
      continue;
    }

    if (current === "-" || /\d/.test(current)) {
      let end = index + 1;
      while (end < line.length && /[0-9eE+.-]/.test(line[end])) {
        end += 1;
      }
      tokens.push({ text: line.slice(index, end), type: "number" });
      index = end;
      continue;
    }

    if (line.startsWith("true", index) || line.startsWith("false", index)) {
      const text = line.startsWith("true", index) ? "true" : "false";
      tokens.push({ text, type: "boolean" });
      index += text.length;
      continue;
    }

    if (line.startsWith("null", index)) {
      tokens.push({ text: "null", type: "null" });
      index += 4;
      continue;
    }

    tokens.push({ text: current, type: "plain" });
    index += 1;
  }

  return tokens;
}

function jsonTokenClassName(type: JsonTokenType) {
  switch (type) {
    case "key":
      return "text-sky-700";
    case "string":
      return "text-emerald-700";
    case "number":
      return "text-amber-700";
    case "boolean":
      return "text-rose-700";
    case "null":
      return "text-fuchsia-700";
    case "punctuation":
      return "text-slate-400";
    default:
      return "text-slate-900";
  }
}
