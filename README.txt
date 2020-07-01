
let ix = new Index({
  name: new analyzer({
    normalizers: [Nlowercase(), Nunaccent(), NspaceBetweenDigits()],
    indexTokenizers: [Twhitespace(), Tedge(1)],
    searchTokenizers: [Twhitespace()]
  }),
  type: new analyzer({
    normalizers: [Nnoop()],
    indexTokenizers: [Tnoop()],
    searchTokenizers: [Tnoop()]
  })
});

/*
or simpler:
let ix = new Index({
  name: autocompleteAnalyzer,
  type: IDanalyzer
});
*/

ix.doIndex(
  [
    { name: "john Crème Brulée", type: "user" },
    { name: "hello world k777bb k9 bzz", type: "user" },
    { name: "jack", type: "admin" },
    { name: "doe" }
  ],
  ["name"]
);

ix.forEach(
  new OR(
    ix.TERM("name", "creme"),
    new AND(
      // matches on k9 because it splits k and 9
      ix.TERM("name", "9"),
      ix.TERM("name", "k"),
      ix.TERM("name", "hell")
    ),
    new AND(ix.TERM("name", "ja"), ix.TERM("type", "user")),
    ix.TERM("name", "doe")
  ),
  function(doc, score) {
    console.log({ doc, score });
  }
);

console.log(ix.topN(ix.TERM("name", "j"), -1));
