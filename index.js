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
const { Lazy, List, LazyList: LL, Vec, Signal, Cont_ } = require("./utils");

const { Nil, Cons } = LL;

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
