var unicode = require("./unicode");
const NO_MORE = Number.MAX_VALUE;

// from https://gist.github.com/shawndumas/1262659
const soundex = function (s) {
  var a = s.toLowerCase().split(""),
    f = a.shift(),
    r = "",
    codes = {
      a: "",
      e: "",
      i: "",
      o: "",
      u: "",
      b: 1,
      f: 1,
      p: 1,
      v: 1,
      c: 2,
      g: 2,
      j: 2,
      k: 2,
      q: 2,
      s: 2,
      x: 2,
      z: 2,
      d: 3,
      t: 3,
      l: 4,
      m: 5,
      n: 5,
      r: 6,
    };

  r =
    f +
    a
      .map(function (v, i, a) {
        return codes[v];
      })
      .filter(function (v, i, a) {
        return i === 0 ? v !== codes[f] : v !== a[i - 1];
      })
      .join("");

  return (r + "000").slice(0, 4).toUpperCase();
};

const addSubQueries = function (to, ...queries) {
  if (queries) {
    for (let q of queries) {
      if (Array.isArray(q)) {
        for (let qq of q) {
          to.add(qq);
        }
      } else {
        to.add(q);
      }
    }
  }
};

const CONSTANT = function (boost, query) {
  this.docID = -1;
  this.score = function () {
    return boost;
  };

  this.next = function () {
    return (this.docID = query.next());
  };

  this.jump = function (target) {
    return (this.docID = query.jump(target));
  };

  this.count = function () {
    return query.count();
  };
};

const OR = function (...queries) {
  this.prototype = new Array();
  this.push = Array.prototype.push;
  this.docID = -1;
  this.add = function (query) {
    if (query) this.push(query);
    return this;
  };

  this.score = function () {
    let score = 0;
    for (let i = 0; i < this.length; i++) {
      if (this[i].docID === this.docID) {
        score += this[i].score();
      }
    }
    return score;
  };

  this.next = function () {
    let new_doc = NO_MORE;
    for (let i = 0; i < this.length; i++) {
      let cur_doc = this[i].docID;
      if (cur_doc === this.docID) cur_doc = this[i].next();
      if (cur_doc < new_doc) new_doc = cur_doc;
    }
    return (this.docID = new_doc);
  };

  this.jump = function (target) {
    let new_doc = NO_MORE;
    for (let i = 0; i < this.length; i++) {
      let cur_doc = this[i].docID;
      if (cur_doc < target) cur_doc = this[i].jump(target);
      if (cur_doc < new_doc) new_doc = cur_doc;
    }

    return (this.docID = new_doc);
  };

  this.count = function () {
    let c = 0;
    for (let i = 0; i < this.length; i++) c += this[i].count();
    return c;
  };
  addSubQueries(this, ...queries);
};

const DISMAX = function (tiebreaker, ...queries) {
  this.prototype = new Array();
  this.push = Array.prototype.push;
  this.docID = -1;
  this.add = function (query) {
    if (query) this.push(query);
    return this;
  };

  this.next = function () {
    let new_doc = NO_MORE;
    for (let i = 0; i < this.length; i++) {
      let cur_doc = this[i].docID;
      if (cur_doc === this.docID) cur_doc = this[i].next();
      if (cur_doc < new_doc) new_doc = cur_doc;
    }
    return (this.docID = new_doc);
  };

  this.jump = function (target) {
    let new_doc = NO_MORE;
    for (let i = 0; i < this.length; i++) {
      let cur_doc = this[i].docID;
      if (cur_doc < target) cur_doc = this[i].jump(target);
      if (cur_doc < new_doc) new_doc = cur_doc;
    }

    return (this.docID = new_doc);
  };

  this.count = function () {
    let c = 0;
    for (let i = 0; i < this.length; i++) c += this[i].count();
    return c;
  };

  this.score = function () {
    let max = 0;
    let sum = 0;
    for (let i = 0; i < this.length; i++) {
      if (this[i].docID === this.docID) {
        let subScore = this[i].score();
        if (subScore > max) {
          max = subScore;
        }
        sum += subScore;
      }
    }
    return max + (sum - max) * tiebreaker;
  };
  addSubQueries(this, ...queries);
};

const AND = function (...queries) {
  this.prototype = new Array();
  this.push = Array.prototype.push;
  this.sort = Array.prototype.sort;
  this.docID = -1;
  let lead = undefined;

  this.add = function (query) {
    if (query) {
      this.push(query);
      this.sort(function (a, b) {
        return a.count() - b.count();
      });
      lead = this[0];
    } else {
      this.length = 0;
    }
    return this;
  };

  this._jump = function (target) {
    if (lead === undefined || this.length == 0) return (this.docID = NO_MORE);

    for (let i = 1; i < this.length; i++) {
      let n = this[i].jump(target);
      if (n > target) {
        target = lead.jump(n);
        i = 1;
      }
    }

    return (this.docID = lead.docID);
  };

  this.next = function () {
    return this._jump(lead.next());
  };

  this.jump = function (target) {
    return this._jump(lead.jump(target));
  };

  this.count = function () {
    for (let i = 0; i < this.length; i++) return this[i].count();
    return 0;
  };

  this.score = function () {
    let score = 0;
    for (let i = 0; i < this.length; i++) {
      score += this[i].score();
    }
    return score;
  };

  addSubQueries(this, ...queries);
};

const TERM = function (nDocumentsInIndex, postingsList) {
  this.docID = -1;
  this.idf = 1 + Math.log(nDocumentsInIndex / (postingsList.length + 1));
  let cursor = 0;

  this.update = function () {
    if (cursor > postingsList.length - 1) return (this.docID = NO_MORE);

    let docID = postingsList[cursor];
    return (this.docID = docID);
  };

  this.count = function () {
    return postingsList.length;
  };

  this.next = function () {
    if (this.docID !== -1) cursor++;

    return this.update();
  };

  this.jump = function (target) {
    if (cursor > postingsList.length - 1) return (this.docID = NO_MORE);

    if (this.docID === target || target === NO_MORE)
      return (this.docID = target);

    let end = this.count();
    let start = Math.min(0, cursor);
    while (start < end) {
      let mid = start + Math.floor((end - start) / 2);
      let doc = postingsList[mid];
      if (doc == target) {
        start = mid;
        break;
      }
      if (doc < target) start = mid + 1;
      else end = mid;
    }
    cursor = start;
    return this.update();
  };

  this.score = function () {
    return 1 + this.idf;
  };
};

const _Tnoop = function () {
  this.apply = function apply(tokens) {
    return tokens;
  };
};

const _Twhitespace = function () {
  this.apply = function apply(tokens) {
    let out = [];
    for (let token of tokens) {
      let current = "";
      for (let i = 0; i < token.length; i++) {
        let c = token.charAt(i);
        if (c == " " || c == "\t" || c == "\n" || c == "\r") {
          if (current.length > 0) {
            out.push(current);
            current = "";
          }
        } else {
          current += c;
        }
      }
      if (current.length > 0) {
        out.push(current);
      }
    }
    return out;
  };
  return this;
};

const _Tsoundex = function () {
  this.apply = function apply(tokens) {
    let out = [];
    for (let token of tokens) {
      out.push(soundex(token));
    }

    return out;
  };
};

const _Tedge = function (n) {
  if (n == 0) {
    n = 1;
  }
  n = n - 1;

  this.apply = function apply(tokens) {
    let out = [];
    for (let token of tokens) {
      if (token.length < n) {
        out.push(token);
      } else {
        for (let i = n; i < token.length; i++) {
          out.push(token.substring(0, i + 1));
        }
      }
    }

    return out;
  };
};

const _Nlowercase = function () {
  this.apply = function apply(s) {
    return s.toLowerCase();
  };
};

const _Nunaccent = function () {
  this.apply = function apply(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };
};

const nonalphanumeric = new RegExp("[^" + unicode.w + "]", "g");
const _NremoveNonAlphanumeric = function () {
  this.apply = function apply(s) {
    return s.replace(nonalphanumeric, " ");
  };
};

const _Nnoop = function () {
  this.apply = function apply(tokens) {
    return tokens;
  };
};

// FIXME: this works only on ascii
const _NspaceBetweenDigits = function () {
  this.apply = function apply(tokens) {
    let digitMode = false;
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      let c = tokens.charAt(i);
      let code = tokens.charCodeAt(i);
      let isDigit = false;
      if (code < 127) {
        // - (dash) = 45
        // 0 = 48
        // 9 = 57
        // space = 32
        isDigit = code == 45 || (code >= 48 && code <= 57);
        if (i == 0) {
          digitMode = isDigit;
          out += c;
          continue;
        }
        if (code != 32) {
          if (isDigit) {
            if (!digitMode) {
              digitMode = true;
              out += " ";
            }
          } else {
            if (digitMode) {
              digitMode = false;
              out += " ";
            }
          }
        }
      }
      out += c;
    }
    return out;
  };
};

const analyzer = function ({ normalizers, indexTokenizers, searchTokenizers }) {
  this.analyzeForIndex = function (s) {
    if (!s) return [];
    return tokenize(normalize(s, normalizers), indexTokenizers);
  };

  this.analyzeForSearch = function (s) {
    if (!s) return [];
    return tokenize(normalize(s, normalizers), searchTokenizers);
  };
};

let Index = function (perFieldAnalyzer) {
  let inverted = {};
  let forward = [];

  this.getAnalyzer = function (field) {
    let a = perFieldAnalyzer[field];
    if (!a) {
      throw new Error("no analyzer for field " + field);
    }
    return a;
  };

  this.doIndex = function (documents, fields) {
    for (let field of fields) {
      let a = this.getAnalyzer(field);
      let inv = inverted[field] || (inverted[field] = {});

      for (let document of documents) {
        let did = forward.length;
        let tokens = a.analyzeForIndex(document[field]);
        for (let token of tokens) {
          let postings = inv[token] || (inv[token] = []);
          // only insert if not the same as previous, we dont count frequency
          if (postings.length == 0 || postings[postings.length - 1] != did) {
            postings.push(did);
          }
        }
        forward.push(document);
      }
    }
  };

  this.terms = function (field, token) {
    let out = [];
    let a = this.getAnalyzer(field);
    for (let t of a.analyzeForSearch(token)) {
      let perField = (inverted[field] || {})[t] || [];
      let term = new TERM(forward.length, perField);
      term.debug = { field, t };
      out.push(term);
    }
    return out;
  };

  this.forEach = function (query, cb) {
    while (query.next() !== NO_MORE) {
      let score = query.score();
      if (score > 0) cb(forward[query.docID], score);
    }
  };

  this.topN = function (query, limit, scorer) {
    let scored = [];
    this.forEach(query, function (doc, score) {
      scored.push([doc, scorer ? scorer(doc, score) : score]);
    });

    // fixme: use priority queue
    scored.sort(function (a, b) {
      return b[1] - a[1];
    });

    if (limit == -1) {
      limit = scored.length;
    }

    let out = [];
    for (let i = 0; i < scored.length && limit > 0; i++, limit--) {
      out.push(scored[i][0]);
    }
    return out;
  };
};

const Tedge = function (n) {
  return new _Tedge(n);
};

const Tsoundex = function () {
  return new _Tsoundex();
};

const Tnoop = function (n) {
  return new _Tnoop(n);
};

const Twhitespace = function () {
  return new _Twhitespace();
};

const Nlowercase = function () {
  return new _Nlowercase();
};

const NspaceBetweenDigits = function () {
  return new _NspaceBetweenDigits();
};

const Nnoop = function () {
  return new _Nnoop();
};

const NremoveNonAlphanumeric = function () {
  return new _NremoveNonAlphanumeric();
};

const Nunaccent = function () {
  return new _Nunaccent();
};

const normalize = function (s, normalizers) {
  for (let n of normalizers) {
    s = n.apply(s);
  }
  return s;
};

const tokenize = function (s, tokenizers) {
  let tokens = [s];
  for (let t of tokenizers) {
    let current = t.apply(tokens);
    tokens = current;
  }
  return tokens;
};

const keywordAnalyzer = new analyzer({
  normalizers: [Nnoop()],
  indexTokenizers: [Tnoop()],
  searchTokenizers: [Tnoop()],
});

const autocompleteAnalyzer = new analyzer({
  normalizers: [
    Nlowercase(),
    Nunaccent(),
    NremoveNonAlphanumeric(),
    NspaceBetweenDigits(),
  ],
  indexTokenizers: [Twhitespace(), Tedge(1)],
  searchTokenizers: [Twhitespace()],
});

const soundexAnalyzer = new analyzer({
  normalizers: [
    Nlowercase(),
    Nunaccent(),
    NremoveNonAlphanumeric(),
    NspaceBetweenDigits(),
  ],
  indexTokenizers: [Twhitespace(), Tsoundex()],
  searchTokenizers: [Twhitespace(), Tsoundex()],
});

const basicAnalyzer = new analyzer({
  normalizers: [
    Nlowercase(),
    Nunaccent(),
    NremoveNonAlphanumeric(),
    NspaceBetweenDigits(),
  ],
  indexTokenizers: [Twhitespace()],
  searchTokenizers: [Twhitespace()],
});

module.exports = {
  Index: Index,

  NO_MORE: NO_MORE,
  CONSTANT: CONSTANT,
  OR: OR,
  DISMAX: DISMAX,
  AND: AND,
  TERM: TERM,

  t: {
    edge: Tedge,
    noop: Tnoop,
    soundex: Tsoundex,
    whitespace: Twhitespace,
  },
  n: {
    lowercase: Nlowercase,
    spaceBetweenDigits: NspaceBetweenDigits,
    noop: Nnoop,
    reomveNonAlphanumeric: NremoveNonAlphanumeric,
    unaccent: Nunaccent,
  },

  analyzer: analyzer,
  normalize: normalize,
  tokenize: tokenize,

  analyzers: {
    keyword: keywordAnalyzer,
    autocomplete: autocompleteAnalyzer,
    soundex: soundexAnalyzer,
    basic: basicAnalyzer,
  },
};
