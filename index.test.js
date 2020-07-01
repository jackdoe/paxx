const {
  Index,
  AND,
  OR,
  TERM,
  CONSTANT,
  DISMAX,
  analyzers
} = require("./index");

let ix = new Index({
  name: analyzers.autocompleteAnalyzer,
  type: analyzers.IDanalyzer
});

ix.doIndex(
  [
    { name: "john Crème Brulée", type: "user" },
    { name: "john another with worse idf", type: "user" },
    { name: "hello world k777bb k9 bzz", type: "user" },
    { name: "jack", type: "admin" },
    { name: "doe world" }
  ],
  ["name"]
);

test("doe", () => {
  expect(ix.topN(ix.TERM("name", "doe"), -1)).toEqual([{ name: "doe world" }]);
});

test("doe OR john", () => {
  let query = new OR(ix.TERM("name", "doe"), ix.TERM("name", "john"));
  let expected = [
    { name: "doe world" },
    { name: "john Crème Brulée", type: "user" },
    { name: "john another with worse idf", type: "user" }
  ];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("doe AND john ", () => {
  let query = new AND(ix.TERM("name", "doe"), ix.TERM("name", "john"));
  let expected = [];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("world AND (john OR hello)", () => {
  let query = new AND(
    ix.TERM("name", "world"),
    new OR(ix.TERM("name", "john"), ix.TERM("name", "hello"))
  );
  let expected = [{ name: "hello world k777bb k9 bzz", type: "user" }];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("doe limit 1", () => {
  let query = ix.TERM("name", "doe");
  let expected = [{ name: "doe world" }];
  expect(ix.topN(query, 1)).toEqual(expected);
});
