const {
  Index,
  AND,
  OR,
  TERM,
  CONSTANT,
  DISMAX,
  analyzers,
  t,
  n
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

test("lowercase", () => {
  expect(n.lowercase().apply("ABC")).toEqual("abc");
});

test("unaccent", () => {
  expect(n.unaccent().apply("Crème Brulée")).toEqual("Creme Brulee");
});

test("space between digits", () => {
  expect(n.spaceBetweenDigits().apply("Crème Brulée 9oz")).toEqual(
    "Crème Brulée  9 oz"
  );
  expect(n.spaceBetweenDigits().apply("ab9999oz xoxo99x")).toEqual(
    "ab 9999 oz xoxo 99 x"
  );
});

test("whitespace", () => {
  expect(t.whitespace().apply(["hello world"])).toEqual(["hello", "world"]);
});

test("whitespace", () => {
  expect(t.edge(1).apply(["hello"])).toEqual([
    "h",
    "he",
    "hel",
    "hell",
    "hello"
  ]);

  expect(t.edge(2).apply(["hello"])).toEqual(["he", "hel", "hell", "hello"]);

  expect(t.edge(10).apply(["hello"])).toEqual(["hello"]);
});

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
