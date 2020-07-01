
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


let ix = new Index({
  name: autocompleteAnalyzer,
  type: IDanalyzer
});

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
    new AND(ix.TERM("name", "ja"), new CONSTANT(1, ix.TERM("type", "user"))),
    new DISMAX(ix.TERM("name", "doe"), ix.TERM("type", "user"))
  ),
  function(doc, score) {
    console.log({ doc, score });
  }
);

console.log(
  ix.topN(
    new DISMAX(0.5, ix.TERM("name", "hello"), ix.TERM("name", "world")),
    -1
  )
);

ix.forEach(
  new OR(0.5, ix.TERM("name", "hello"), ix.TERM("name", "world")),
  function(doc, score) {
    console.log({ doc, score });
  }
);

ix.forEach(
  new DISMAX(
    0.5,
    ix.TERM("name", "hello"),
    new CONSTANT(1000, ix.TERM("name", "world"))
  ),
  function(doc, score) {
    console.log({ doc, score });
  }
);


outputs:

{ doc: { name: 'john Crème Brulée', type: 'user' },
  score: 2.6931471805599454 }
{ doc: { name: 'hello world k777bb k9 bzz', type: 'user' },
  score: 7.673976433571672 }
{ doc: { name: 'doe' }, score: 2.6931471805599454 }



and (for topN)

[ { name: 'hello world k777bb k9 bzz', type: 'user' } ]


and

{ doc: { name: 'hello world k777bb k9 bzz', type: 'user' },
  score: 5.386294361119891 }
{ doc: { name: 'hello world k777bb k9 bzz', type: 'user' },
  score: 1001.34657359028 }