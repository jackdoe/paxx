ix.doIndex(
  [
    { name: "john", type: "user" },
    { name: "jack", type: "admin" },
    { name: "doe" }
  ],
  ["name"]
);

ix.forEach(
  new OR(
    new AND(ix.TERM("name", "ja"), ix.TERM("type", "user")),
    ix.TERM("name", "doe")
  ),
  function(doc, score) {
    console.log({ doc, score });
  }
);

console.log(ix.topN(ix.TERM("name", "j"), -1));