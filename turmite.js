const Canvas = require("terminal-canvas");
const { Arr, Cont, State, ana } = require("@masaeedu/fp");
const { match, adt } = require("@masaeedu/adt");

const { LazyList: LL, Vec, Cont_ } = require("./utils");
const { Nil, Cons } = LL;

// ## LOGIC ##
// :: type Move a = State a Angle
// :: type Turmite a = [Move a]

// :: [Angle, Angle, Angle, Angle]
const Direction = Arr.map(i => (i * Math.PI) / 2)(Arr.range(4));
const [U, L, D, R] = Direction;

// :: Turmite Boolean
const langton = (() => {
  const step = State[">>="](State.get)(b =>
    State["<$"](b ? L : R)(State.put(!b))
  );
  return LL.repeat(step);
})();

// ## RENDERING ##
const canvas = new Canvas();

const toKey = ([x, y]) => `${x},${y}`;
const transition = ({ grid, pos, θ }) => a => {
  const k = toKey(pos);
  const c = grid.has(k);

  // Evaluate the turmite's state transition
  const [φ, c_] = a(c);

  // Update the grid with any changes the turmite made
  const grid_ = new Set(grid);
  if (c_) {
    grid_.add(k);
  } else {
    grid_.delete(k);
  }

  // Compute the new orientation and position
  const θ_ = θ + φ;
  const pos_ = Vec.add(pos)(Vec.rotate(θ_)([0, 1]));

  return cb => {
    canvas
      .moveTo(...pos)
      .background(c ? "black" : "white")
      .write(" ")
      .flush();
    canvas
      .moveTo(...pos_)
      .background("red")
      .write(" ")
      .flush();

    setTimeout(() => cb({ grid: grid_, pos: pos_, θ: θ_ }), 5);
  };
};

const grid = new Set();
const pos = [process.stdout.columns / 2, process.stdout.rows / 2];
const θ = R;
const main = LL.foldM(Cont)(transition)({ grid, pos, θ })(langton);

Cont_.runCont(main);
