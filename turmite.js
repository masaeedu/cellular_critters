const Canvas = require("terminal-canvas");
const { Arr, Cont, State, ana } = require("@masaeedu/fp");
const { match, adt } = require("@masaeedu/adt");

const { LazyList: LL, Vec, Cont_ } = require("./utils");
const { Nil, Cons } = LL;

// ## LOGIC ##
// :: type Move a = State a Angle
// :: type Turmite a = LazyList (Move a)

// :: [Angle, Angle, Angle, Angle]
const Direction = Arr.map(i => (i * Math.PI) / 2)(Arr.range(4));
const [U, L, D, R] = Direction;

// :: Vector n Direction -> Turmite (LessThan n)
const ant = d => {
  const l = d.length;
  const move = State[">>="](State.get)(i =>
    State["<$"](d[i])(State.put((i + 1) % l))
  );
  return LL.repeat(move);
};

// :: Turmite (LessThan 2)
const langton = ant([L, R]);

// :: Turmite (LessThan 3)
const rlr = ant([R, L, R]);

// ## RENDERING ##
const canvas = new Canvas();
// :: Cont! ()
const writeBlock = color => pos => cb => {
  canvas
    .moveTo(...pos)
    .background(color)
    .write(" ")
    .flush();
  cb(undefined);
};

const toKey = ([x, y]) => `${x},${y}`;

const step = colors => ({ grid, pos, θ }) => a => {
  const k = toKey(pos);
  const i = grid[k] || 0;

  // Evaluate the turmite's state transition
  const [φ, i_] = a(i);

  // Update the grid with any changes the turmite made
  const grid_ = { ...grid, [k]: i_ };

  // Compute the new orientation and position
  const θ_ = θ + φ;
  const pos_ = Vec.add(pos)(Vec.rotate(θ_)([0, 1]));

  // Updated state
  const s = { grid: grid_, pos: pos_, θ: θ_ };

  // The effect we're going to perform
  const draw = Arr.sequence(Cont)([
    Cont_.delay_(0),
    writeBlock(colors[i_])(pos)
  ]);

  return Cont["<$"](s)(draw);
};

const grid = new Map();
const pos = [process.stdout.columns / 2, process.stdout.rows / 2];
const θ = L;
const s0 = { grid, pos, θ };

const simulate = ant => colors => LL.foldM(Cont)(step(colors))(s0)(ant);

const main = simulate(ant([L, L, R, R]))([
  "#FF00FF",
  "#00FF00",
  "#8B008B",
  "black"
]);

Cont_.runCont(main);
