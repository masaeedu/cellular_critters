const Canvas = require("terminal-canvas");
const {
  Fn,
  Arr,
  Fnctr,
  cata,
  ana,
  hylo,
  implement,
  Chain,
  Apply,
  Functor
} = require("@masaeedu/fp");
const { adt, match } = require("@masaeedu/adt");

// ## UTILS ##
const monad = Fn.pipe(Arr.map(implement)([Chain, Apply, Functor, Apply]));

// :: type Lazy x = () -> x
const Lazy = (() => {
  // :: (() -> a) -> Lazy a
  const defer = thunk => thunk;
  // :: Lazy a -> a
  const force = x => x();

  // :: a -> Lazy a
  const of = x => defer(_ => x);
  // :: (a -> Lazy b) -> Lazy a -> Lazy b
  const chain = amb => ma => defer(_ => force(amb(force(ma))));

  return monad({ defer, force, of, chain });
})();

const List = (() => {
  const List = adt({ Nil: [], Cons: ["a", "b"] });
  const { Nil, Cons, match } = List;
  const Base = { map: f => match({ Nil, Cons: x => xs => Cons(x)(f(xs)) }) };

  const range = n => ana(Base)(i => (i === n ? Nil : Cons(i)(i + 1)))(0);

  const fromArray = ana(Base)(Arr.match(List));
  const toArray = cata(Base)(List.match(Arr));

  return { Nil, Cons, match, Base, range, fromArray, toArray };
})();

// :: type LazyListF a b = Lazy (ListF a b)
// :: type LazyList = Fix LazyListF

const LazyList = (() => {
  const Base = Fnctr.append(Lazy)(List.Base);

  // :: LazyList a
  const Nil = Lazy.defer(_ => List.Nil);
  // :: x -> LazyList x -> LazyList x
  const Cons = x => xs => Lazy.defer(_ => List.Cons(x)(xs));
  // :: { Nil: Lazy x, Cons: a -> LazyList a -> Lazy x } -> LazyList a -> Lazy x
  const match = A => Lazy.chain(List.match(A));

  const LazyList = { Nil, Cons, match };

  // :: Int -> LazyList Int
  const range = n => ana(Base)(i => (i === n ? Nil : Cons(i)(i + 1)))(0);

  // :: [x] -> LazyList x
  const fromArray = ana(Base)(Arr.match(LazyList));
  // :: LazyList x -> [x]
  const toArray = cata(Base)(Fn["<:"](List.match(Arr))(Lazy.force));

  // :: (a -> b) -> LazyList a -> LazyList b
  const map = f => cata(Base)(match({ Nil, Cons: x => Cons(f(x)) }));

  // :: Int -> LazyList x -> LazyList x
  const take = n =>
    n === 0
      ? _ => Nil
      : match({
          Nil,
          Cons: x => xs => Cons(x)(take(n - 1)(xs))
        });

  // :: LazyList x -> LazyList x -> LazyList x
  const append = xs => ys =>
    match({
      Nil: ys,
      Cons: x => xs => Cons(x)(append(xs)(ys))
    })(xs);

  return {
    Base,
    Nil,
    Cons,
    match,
    range,
    fromArray,
    toArray,
    map,
    take,
    append
  };
})();
const LL = LazyList;
const { Nil, Cons, fromArray, toArray } = LL;

const Vec = (() => {
  const { sin, cos } = Math;

  const rotate = θ => ([x, y]) => [
    Math.round(x * cos(θ) - y * sin(θ)),
    Math.round(x * sin(θ) + y * cos(θ))
  ];

  const add = ([x0, y0]) => ([x1, y1]) => [x0 + x1, y0 + y1];

  return { rotate, add };
})();

// ## MAIN ##

// :: type Step = { leg: LazyList Vec2, transform: Transform2 }

// :: Int -> LazyListF Step Int
const step = i => {
  const n = Math.floor(i / 2) + 1;
  const leg = LL.map(x => [x, 0])(LL.range(n));
  const transform = Fn.pipe([
    // 90 deg ccw rotation
    Vec.rotate(Math.PI / 2),
    // Rightwards displacement by the length of the leg we rendered
    Vec.add([n, 0])
  ]);

  return Cons({ leg, transform })(i + 1);
};

// :: LazyListF Step (LazyList Vec2) -> LazyList Vec2
const trace = LL.match({
  Nil,
  Cons: ({ leg, transform }) => Fn.pipe([LL.map(transform), LL.append(leg)])
});

const result = hylo(LL.Base)(trace)(step)(0);

// ## TEST ##
const origin = [process.stdout.columns / 2, process.stdout.rows / 2];
const canvas = new Canvas();
const renderPoint = x =>
  Lazy.defer(_ =>
    canvas
      .moveTo(...x)
      .foreground("red")
      .write("*")
      .flush()
  );

const interpret = LL.match({
  Nil: Lazy.of(undefined),
  Cons: point => rest =>
    Lazy["*>"](renderPoint(Vec.add(origin)(point)))(_ =>
      setTimeout(interpret(rest), 5)
    )
});

interpret(result)();
