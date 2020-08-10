const {
  Index,
  AND,
  OR,
  TERM,
  CONSTANT,
  DISMAX,
  analyzers,
  t,
  n,
} = require("./index");

let ix = new Index({
  name: analyzers.autocomplete,
  type: analyzers.keyword,
});

ix.doIndex(
  [
    { name: "john Crème Brulée", type: "user", pop: 1 },
    { name: "john another with worse idf", type: "user", pop: 2 },
    { name: "hello world k777bb k9 bzz", type: "user", pop: 3 },
    { name: "jack", type: "admin", pop: 400 },
    { name: "doe world", pop: 1000 },
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
    "hello",
  ]);

  expect(t.edge(2).apply(["hello"])).toEqual(["he", "hel", "hell", "hello"]);

  expect(t.edge(10).apply(["hello"])).toEqual(["hello"]);
});

test("ngram", () => {
  expect(t.ngram(1, 3).apply(["hello", "good", "bye", "world"])).toEqual([
    "hello",
    "hellogood",
    "hellogoodbye",
    "good",
    "goodbye",
    "goodbyeworld",
    "bye",
    "byeworld",
    "world",
  ]);

  expect(t.ngram(1, 5).apply(["hello", "good", "bye", "world"])).toEqual([
    "hello",
    "hellogood",
    "hellogoodbye",
    "hellogoodbyeworld",
    "good",
    "goodbye",
    "goodbyeworld",
    "bye",
    "byeworld",
    "world",
  ]);

  expect(t.ngram(2, 2).apply(["hello", "good", "bye", "world"])).toEqual([
    "hellogood",
    "goodbye",
    "byeworld",
  ]);

  expect(t.ngram(1, 2).apply(["hello", "good", "bye", "world"])).toEqual([
    "hello",
    "hellogood",
    "good",
    "goodbye",
    "bye",
    "byeworld",
    "world",
  ]);
});

test("doe", () => {
  expect(ix.topN(new OR(...ix.terms("name", "doe")), -1)).toEqual([
    { name: "doe world", pop: 1000 },
  ]);
});

test("doe OR john", () => {
  let query = new OR(...ix.terms("name", "doe"), ...ix.terms("name", "john"));
  let expected = [
    { name: "doe world", pop: 1000 },
    { name: "john Crème Brulée", type: "user", pop: 1 },
    { name: "john another with worse idf", type: "user", pop: 2 },
  ];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("doe AND john ", () => {
  let query = new AND(...ix.terms("name", "doe"), ...ix.terms("name", "john"));
  let expected = [];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("world AND (john OR hello)", () => {
  let query = new AND(
    ...ix.terms("name", "world"),
    new OR(...ix.terms("name", "john"), ...ix.terms("name", "hello"))
  );
  let expected = [{ name: "hello world k777bb k9 bzz", type: "user", pop: 3 }];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("doe limit 1", () => {
  let query = new OR(...ix.terms("name", "doe"));
  let expected = [{ name: "doe world", pop: 1000 }];
  expect(ix.topN(query, 1)).toEqual(expected);
});

test("hello and world", () => {
  let query = new AND(...ix.terms("name", "hello world 9k"));
  let expected = [{ name: "hello world k777bb k9 bzz", type: "user", pop: 3 }];
  expect(ix.topN(query, -1)).toEqual(expected);
});

test("hello and world scorer", () => {
  let query = new AND(...ix.terms("name", "w"));
  let expected = [{ name: "doe world", pop: 1000 }];

  expect(
    ix.topN(query, 1, function (doc, score) {
      return doc.pop;
    })
  ).toEqual(expected);
});

test("insertion order", () => {
  let ix = new Index({
    name: analyzers.autocomplete,
  });

  ix.doIndex(
    [{ name: "john" }, { name: "doe world" }, { name: "hello world" }],
    ["name"]
  );

  let expected = [{ name: "doe world" }, { name: "hello world" }];
  let expectedInvert = [{ name: "hello world" }, { name: "doe world" }];
  expect(
    ix.topN(new AND(...ix.terms("name", "world")), -1, function (
      doc,
      score,
      docID
    ) {
      return -docID;
    })
  ).toEqual(expected);

  expect(
    ix.topN(new AND(...ix.terms("name", "world")), -1, function (
      doc,
      score,
      docID
    ) {
      return docID;
    })
  ).toEqual(expectedInvert);
});

test("soundex johm", () => {
  let ix = new Index({
    name: analyzers.soundex,
  });

  ix.doIndex(
    [
      { name: "john Crème Brulée" },
      { name: "bohn" },
      { name: "johm johm johm" },
    ],
    ["name"]
  );

  expect(ix.topN(new OR(ix.terms("name", "johm")), -1)).toEqual([
    { name: "john Crème Brulée" },
    { name: "johm johm johm" },
  ]);
});

test("soundex johm", () => {
  let ix = new Index({
    name: analyzers.soundex,
  });

  ix.doIndex(
    [
      { name: "hello world" },
      { name: "hellu world" },
      { name: "helo world" },
      { name: "helz world" },
      { name: "goodbye world" },
    ],
    ["name"]
  );
  expect(ix.topN(new OR(ix.terms("name", "hallo")), -1)).toEqual([
    { name: "hello world" },
    { name: "hellu world" },
    { name: "helo world" },
  ]);
});

test("basic", () => {
  let ix = new Index({
    name: analyzers.basic,
  });

  ix.doIndex(
    [
      { name: "john Crème Brulée /a/b/c/え/d" },
      { name: "bohn" },
      { name: "johm johm johm" },
    ],
    ["name"]
  );

  expect(ix.topN(new OR(ix.terms("name", "え")), -1)).toEqual([
    { name: "john Crème Brulée /a/b/c/え/d" },
  ]);
});

test("many fields", () => {
  let ix = new Index({
    first_name: analyzers.basic,
    last_name: analyzers.basic,
  });

  ix.doIndex(
    [
      { first_name: "john bon", last_name: "jovi jr" },
      { first_name: "aa bb cc", last_name: "dd ee" },
    ],
    ["first_name", "last_name"]
  );

  expect(
    ix.topN(
      new OR(
        ...ix.terms("first_name", "john bon"),
        ...ix.terms("last_name", "jovi")
      ),
      -1
    )
  ).toEqual([{ first_name: "john bon", last_name: "jovi jr" }]);

  expect(
    ix.topN(
      new OR(
        0.5,
        new OR(...ix.terms("first_name", "john bon")),
        new OR(...ix.terms("last_name", "jovi"))
      ),
      -1
    )
  ).toEqual([{ first_name: "john bon", last_name: "jovi jr" }]);
});

test("bad input", () => {
  let ix = new Index({
    name: analyzers.autocomplete,
  });

  ix.doIndex([{ name: "john bon `" }, { name: "bzbz" }], ["name"]);

  expect(
    ix.topN(
      new DISMAX(
        0.5,
        new AND(...ix.terms("name", "`")),
        new AND(...ix.terms("name", "bon"))
      ),
      -1
    )
  ).toEqual([{ name: "john bon `" }]);
});

test("empty", () => {
  let ix = new Index({
    name: analyzers.autocomplete,
  });

  ix.doIndex([{ name: "john bon `" }, { name: "bzbz" }], ["name"]);

  expect(
    ix.topN(
      new OR(
        new AND(),
        new DISMAX(0.5, new AND(), new OR(), new DISMAX()),
        new OR(),
        new DISMAX(0.1),
        new TERM(0, [])
      ),
      -1
    )
  ).toEqual([]);
});

test("keyword", () => {
  let ix = new Index({
    name: analyzers.autocomplete,
  });

  ix.doIndex([{ name: "john bon" }, { name: "bzbz" }], ["name"]);

  expect(ix.topN(new OR(...ix.terms("name", "johnb")))).toEqual([
    { name: "john bon" },
  ]);
});

test("undefined limit", () => {
  let ix = new Index({
    name: analyzers.autocomplete,
  });

  ix.doIndex(
    [{ name: "john bon" }, { name: "john don" }, { name: "bzbz" }],
    ["name"]
  );

  expect(ix.topN(new OR(...ix.terms("name", "john")))).toEqual([
    { name: "john bon" },
    { name: "john don" },
  ]);
  expect(ix.topN(new OR(...ix.terms("name", "john")), 0)).toEqual([]);
});

test("big index", () => {
  let ix = new Index({
    name: analyzers.autocomplete,
    type: analyzers.keyword,
  });

  let iter = 10000;
  let forward = [];
  for (let i = 0; i < iter; i++) {
    let docs = [
      { name: "john Crème Brulée", type: "user" },
      { name: "john another with worse idf", type: "user" },
      { name: "hello world k777bb k9 bzz", type: "user" },
      { name: "jack", type: "admin" },
      { name: "doe world" },
      { name: "world" },
    ];

    ix.doIndex(docs, ["name"]);
    forward = forward.concat(docs);
  }

  //let t0 = +new Date();
  //let top = ix.topN(new OR(ix.terms("name", "another")));
  //expect(top.length).toEqual(iter);
  //let took = new Date() - t0;
  //console.log("inverted", { took });
  //t0 = +new Date();
  //top = [];
  //for (let d of forward) {
  //  if (d.name.match("another")) {
  //    top.push(d);
  //  }
  //}
  //expect(top.length).toEqual(iter);
  //took = new Date() - t0;
  //console.log("foreach", { took });

  expect(ix.topN(new OR(ix.terms("name", "doe")), -1).length).toEqual(iter);
  expect(ix.topN(new OR(ix.terms("name", "world")), -1).length).toEqual(
    iter * 3
  );
  expect(
    ix.topN(
      new AND(...ix.terms("name", "world"), ...ix.terms("name", "doe")),
      -1
    ).length
  ).toEqual(iter);

  expect(
    ix.topN(
      new OR(
        new AND(...ix.terms("name", "world"), ...ix.terms("name", "doe")),
        ...ix.terms("name", "john")
      ),
      -1
    ).length
  ).toEqual(iter * 3);
});
