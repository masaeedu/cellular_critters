const Canvas = require("terminal-canvas");
const {
  Fn,
  Arr,
  Obj,
  Fnctr,
  Cont,
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

  // :: x -> LazyList x
  const repeat = ana(Base)(x => Cons(x)(x));

  // :: (a -> b -> c) -> LazyList a -> LazyList b -> LazyList c
  const zipWith = f => l1 => l2 =>
    Fn.flip(match)(l1)({
      Nil,
      Cons: x => xs =>
        Fn.flip(match)(l2)({
          Nil,
          Cons: y => ys => Cons(f(x)(y))(zipWith(f)(xs)(ys))
        })
    });

  // :: Applicative LazyList
  const Zip = {
    of: repeat,
    lift2: zipWith
  };

  // :: Int -> LazyList Int
  const range = n => ana(Base)(i => (i === n ? Nil : Cons(i)(i + 1)))(0);

  // :: LazyList Int
  const nats = range(Infinity);

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

  // :: Monad m -> (a -> b -> m a) -> m a -> LazyList b -> m a
  const foldM = M => f => z =>
    Fn.pipe([
      Lazy.force,
      List.match({
        Nil: M.of(z),
        Cons: x => xs => M[">>="](f(z)(x))(a => foldM(M)(f)(a)(xs))
      })
    ]);

  // :: [x] -> LazyList x
  const fromArray = ana(Base)(Arr.match(LazyList));
  // :: LazyList x -> [x]
  const toArray = cata(Base)(Fn["<:"](List.match(Arr))(Lazy.force));

  return {
    Base,
    Nil,
    Cons,
    match,
    repeat,
    zipWith,
    Zip,
    range,
    nats,
    map,
    take,
    append,
    foldM,
    fromArray,
    toArray
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

// :: Byte -> Hex
const byte2hex = n => {
  const nybHexString = "0123456789ABCDEF";
  return (
    String(nybHexString.substr((n >> 4) & 0x0f, 1)) +
    nybHexString.substr(n & 0x0f, 1)
  );
};

// :: [Byte, Byte, Byte] -> Color
const rgb2hex = ([r, g, b]) => `#${byte2hex(r)}${byte2hex(g)}${byte2hex(b)}`;

// :: type Signal v = Real -> v
const Signal = (() => {
  // :: Signal Real
  const { sin } = Math;
  // :: Frequency -> Signal Real -> Signal Real
  const accelerate = freq => Fn.contramap(x => x * freq);
  // :: Real -> Signal Real -> Signal Real
  const amplify = a => Fn.map(y => y * a);
  // :: Real -> Signal Real -> Signal Real
  const vshift = v => Fn.map(y => y + v);
  // :: Real -> Signal v -> Signal v
  const phase = dx => Fn.contramap(x => x + dx);
  // :: Signal Color
  const rainbow = f =>
    Fn.passthru([0, 2, 4])([
      Arr.traverse(Fn)(p =>
        Fn.passthru(sin)([phase(p), accelerate(f), amplify(127), vshift(128)])
      ),
      Fn.map(rgb2hex)
    ]);

  return { rainbow };
})();

const Cont_ = (() => {
  const delay = v => d => cb => setTimeout(() => cb(v), d);
  const delay_ = delay(undefined);
  const runCont = c => c(_ => {});

  return { delay, delay_, runCont };
})();

// ## MAIN ##

// :: type Step = { leg: LazyList Vec2, transform: Transform2 }

// :: LazyList Vec2
const x_axis = LL.map(x => [x, 0])(LL.nats);

// :: Vec2 -> LazyListF Step Vec2
const inwards = ([w, h]) => {
  const leg = LL.take(w)(x_axis);
  const transform = Fn.pipe([Vec.rotate(Math.PI / 2), Vec.add([w - 1, 1])]);

  return w * h === 0 ? Nil : Cons({ leg, transform })([h - 1, w]);
};

// :: Int -> LazyListF Step Int
const outwards = i => {
  const n = Math.floor(i / 2) + 1;
  const leg = LL.take(n)(x_axis);
  const transform = Fn.pipe([Vec.rotate(-Math.PI / 2), Vec.add([n, 0])]);

  return Cons({ leg, transform })(i + 1);
};

// :: LazyListF Step (LazyList Vec2) -> LazyList Vec2
const trace = LL.match({
  Nil,
  Cons: ({ leg, transform }) => Fn.pipe([LL.map(transform), LL.append(leg)])
});

const spiral = hylo(LL.Base)(trace)(outwards)(0);

// ## DRAW ##
const rainbowSpiral = Obj.sequence(LL.Zip)({
  i: LL.nats,
  color: LL.map(Signal.rainbow(0.05))(LL.nats),
  point: spiral
});
const origin = [process.stdout.columns / 2, process.stdout.rows / 2];
const canvas = new Canvas();
const renderPoint = ({ i, color, point }) => cb => {
  canvas
    .moveTo(...Vec.add(origin)(point))
    .foreground(color)
    .write((i % 10).toString())
    .flush();
  cb(undefined);
};
const renderAndWait = p =>
  Arr.sequence(Cont)([renderPoint(p), Cont_.delay_(50)]);
const main = LL.foldM(Cont)(Fn.const(renderAndWait))(undefined)(rainbowSpiral);

Cont_.runCont(main);
