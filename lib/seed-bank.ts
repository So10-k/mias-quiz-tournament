// 600+ pre-seeded question library, packed compactly for readability.
// Each `Pack` shares subject/age/difficulty so we don't repeat them per row.
//
// Tuple shape: [prompt, correctAnswer, ...wrongAnswers]
// 2-6 wrong answers allowed. Correct answer is always first; the UI renders
// them in shuffled order.

export type Subject =
  | "general"
  | "math"
  | "reading"
  | "science"
  | "history"
  | "geography"
  | "animals"
  | "words"
  | "riddles"
  | "logic"
  | "art"
  | "music"
  | "sports";

export type SeedQ = {
  prompt: string;
  options: { label: string; isCorrect: boolean }[];
  subject: Subject;
  ageMin: number;
  ageMax: number;
  difficulty: number;
};

type Row = [string, string, ...string[]];
type Pack = {
  subject: Subject;
  ageMin: number;
  ageMax: number;
  difficulty: number;
  rows: Row[];
};

function expand(p: Pack): SeedQ[] {
  return p.rows.map(([prompt, correct, ...wrongs]) => ({
    prompt,
    options: [
      { label: correct, isCorrect: true },
      ...wrongs.map((w) => ({ label: w, isCorrect: false })),
    ],
    subject: p.subject,
    ageMin: p.ageMin,
    ageMax: p.ageMax,
    difficulty: p.difficulty,
  }));
}

// ─── Math: easy addition (5-7) ──────────────────────────────────────────────
const mathAdd: Pack = {
  subject: "math", ageMin: 5, ageMax: 7, difficulty: 1,
  rows: [
    ["What is 1 + 1?", "2", "1", "3", "11"],
    ["What is 2 + 2?", "4", "3", "5", "22"],
    ["What is 3 + 1?", "4", "2", "3", "5"],
    ["What is 2 + 3?", "5", "4", "6", "23"],
    ["What is 4 + 1?", "5", "3", "4", "6"],
    ["What is 5 + 0?", "5", "0", "10", "55"],
    ["What is 3 + 3?", "6", "5", "7", "33"],
    ["What is 4 + 2?", "6", "5", "7", "8"],
    ["What is 5 + 1?", "6", "4", "5", "7"],
    ["What is 4 + 3?", "7", "6", "8", "12"],
    ["What is 6 + 1?", "7", "5", "6", "8"],
    ["What is 5 + 2?", "7", "6", "8", "9"],
    ["What is 4 + 4?", "8", "7", "9", "16"],
    ["What is 5 + 3?", "8", "7", "9", "12"],
    ["What is 6 + 2?", "8", "7", "9", "10"],
    ["What is 7 + 1?", "8", "6", "7", "9"],
    ["What is 5 + 4?", "9", "8", "10", "11"],
    ["What is 6 + 3?", "9", "8", "10", "12"],
    ["What is 7 + 2?", "9", "8", "10", "11"],
    ["What is 5 + 5?", "10", "9", "11", "15"],
    ["What is 6 + 4?", "10", "9", "11", "14"],
    ["What is 7 + 3?", "10", "9", "11", "13"],
    ["What is 8 + 2?", "10", "8", "9", "11"],
    ["What is 9 + 1?", "10", "8", "9", "11"],
    ["What is 6 + 6?", "12", "10", "11", "13"],
    ["What is 7 + 5?", "12", "11", "13", "10"],
    ["What is 8 + 4?", "12", "10", "11", "13"],
    ["What is 9 + 3?", "12", "10", "11", "13"],
    ["What is 10 + 5?", "15", "12", "14", "16"],
    ["What is 8 + 8?", "16", "14", "15", "17"],
  ],
};

// ─── Math: easy subtraction (5-7) ───────────────────────────────────────────
const mathSub: Pack = {
  subject: "math", ageMin: 5, ageMax: 8, difficulty: 1,
  rows: [
    ["What is 5 − 1?", "4", "3", "5", "6"],
    ["What is 6 − 2?", "4", "3", "5", "8"],
    ["What is 7 − 3?", "4", "3", "5", "10"],
    ["What is 4 − 0?", "4", "0", "3", "5"],
    ["What is 8 − 3?", "5", "4", "6", "11"],
    ["What is 9 − 4?", "5", "4", "6", "13"],
    ["What is 10 − 5?", "5", "4", "6", "15"],
    ["What is 7 − 1?", "6", "5", "7", "8"],
    ["What is 8 − 2?", "6", "5", "7", "10"],
    ["What is 9 − 3?", "6", "5", "7", "12"],
    ["What is 9 − 2?", "7", "6", "8", "11"],
    ["What is 10 − 3?", "7", "6", "8", "13"],
    ["What is 12 − 5?", "7", "6", "8", "17"],
    ["What is 10 − 2?", "8", "7", "9", "12"],
    ["What is 11 − 3?", "8", "7", "9", "14"],
    ["What is 12 − 4?", "8", "7", "9", "16"],
    ["What is 11 − 2?", "9", "8", "10", "13"],
    ["What is 12 − 3?", "9", "8", "10", "15"],
    ["What is 13 − 4?", "9", "8", "10", "17"],
    ["What is 15 − 6?", "9", "8", "10", "21"],
    ["What is 14 − 4?", "10", "9", "11", "18"],
    ["What is 16 − 6?", "10", "9", "11", "22"],
    ["What is 20 − 10?", "10", "9", "11", "30"],
    ["What is 15 − 4?", "11", "10", "12", "19"],
    ["What is 18 − 6?", "12", "11", "13", "24"],
    ["What is 20 − 5?", "15", "13", "14", "16"],
    ["What is 25 − 10?", "15", "14", "16", "35"],
    ["What is 30 − 15?", "15", "14", "16", "45"],
    ["What is 100 − 1?", "99", "90", "98", "101"],
    ["What is 50 − 25?", "25", "24", "26", "75"],
  ],
};

// ─── Math: multiplication (7-10) ────────────────────────────────────────────
const mathMul: Pack = {
  subject: "math", ageMin: 7, ageMax: 10, difficulty: 2,
  rows: [
    ["What is 2 × 2?", "4", "2", "6", "22"],
    ["What is 2 × 3?", "6", "5", "8", "23"],
    ["What is 2 × 4?", "8", "6", "10", "24"],
    ["What is 2 × 5?", "10", "7", "12", "25"],
    ["What is 2 × 6?", "12", "8", "14", "26"],
    ["What is 2 × 7?", "14", "12", "16", "27"],
    ["What is 2 × 8?", "16", "14", "18", "28"],
    ["What is 2 × 9?", "18", "16", "20", "29"],
    ["What is 2 × 10?", "20", "12", "22", "200"],
    ["What is 3 × 3?", "9", "6", "12", "33"],
    ["What is 3 × 4?", "12", "9", "15", "34"],
    ["What is 3 × 5?", "15", "8", "18", "35"],
    ["What is 3 × 6?", "18", "15", "21", "36"],
    ["What is 3 × 7?", "21", "18", "24", "37"],
    ["What is 3 × 8?", "24", "21", "27", "38"],
    ["What is 3 × 9?", "27", "24", "30", "39"],
    ["What is 3 × 10?", "30", "23", "33", "300"],
    ["What is 4 × 4?", "16", "12", "20", "44"],
    ["What is 4 × 5?", "20", "16", "24", "45"],
    ["What is 4 × 6?", "24", "20", "28", "46"],
    ["What is 4 × 7?", "28", "24", "32", "47"],
    ["What is 4 × 8?", "32", "28", "36", "48"],
    ["What is 4 × 9?", "36", "32", "40", "49"],
    ["What is 5 × 5?", "25", "20", "30", "55"],
    ["What is 5 × 6?", "30", "25", "35", "56"],
    ["What is 5 × 7?", "35", "30", "40", "57"],
    ["What is 5 × 8?", "40", "35", "45", "58"],
    ["What is 5 × 9?", "45", "40", "50", "59"],
    ["What is 5 × 10?", "50", "45", "55", "500"],
    ["What is 6 × 6?", "36", "30", "42", "66"],
    ["What is 6 × 7?", "42", "36", "48", "67"],
    ["What is 6 × 8?", "48", "42", "54", "68"],
    ["What is 6 × 9?", "54", "48", "60", "69"],
    ["What is 7 × 7?", "49", "42", "56", "77"],
    ["What is 7 × 8?", "56", "49", "63", "78"],
    ["What is 7 × 9?", "63", "56", "70", "79"],
    ["What is 8 × 8?", "64", "56", "72", "88"],
    ["What is 8 × 9?", "72", "64", "80", "89"],
    ["What is 9 × 9?", "81", "72", "90", "99"],
    ["What is 10 × 10?", "100", "90", "110", "1000"],
  ],
};

// ─── Math: division & fractions (8-12) ─────────────────────────────────────
const mathDiv: Pack = {
  subject: "math", ageMin: 8, ageMax: 12, difficulty: 3,
  rows: [
    ["What is 10 ÷ 2?", "5", "4", "6", "20"],
    ["What is 12 ÷ 3?", "4", "3", "5", "9"],
    ["What is 15 ÷ 5?", "3", "2", "4", "10"],
    ["What is 18 ÷ 6?", "3", "2", "4", "12"],
    ["What is 20 ÷ 4?", "5", "4", "6", "16"],
    ["What is 24 ÷ 6?", "4", "3", "5", "18"],
    ["What is 28 ÷ 7?", "4", "3", "5", "21"],
    ["What is 36 ÷ 6?", "6", "5", "7", "30"],
    ["What is 49 ÷ 7?", "7", "6", "8", "42"],
    ["What is 64 ÷ 8?", "8", "7", "9", "56"],
    ["What is 81 ÷ 9?", "9", "8", "10", "72"],
    ["What is 100 ÷ 10?", "10", "9", "11", "1000"],
    ["What is 1/2 of 10?", "5", "2", "20", "100"],
    ["What is 1/4 of 20?", "5", "4", "10", "16"],
    ["What is 1/3 of 9?", "3", "2", "6", "27"],
    ["What is 1/2 of 100?", "50", "25", "10", "200"],
    ["Which fraction is bigger?", "1/2", "1/4", "1/8", "1/100"],
    ["Which fraction is smaller?", "1/10", "1/2", "1/3", "1/4"],
    ["What is 0.5 written as a fraction?", "1/2", "1/5", "5/10 (also okay)", "0/5"],
    ["How many quarters are in one whole?", "4", "2", "10", "25"],
    ["How many halves are in one whole?", "2", "1", "4", "10"],
    ["How many tenths are in one whole?", "10", "1", "100", "5"],
    ["What is 2/4 simplified?", "1/2", "1/4", "2/2", "4/2"],
    ["What is 50% of 80?", "40", "30", "50", "100"],
    ["What is 25% of 100?", "25", "10", "50", "75"],
  ],
};

// ─── Math: word problems & reasoning (8-13) ─────────────────────────────────
const mathWord: Pack = {
  subject: "math", ageMin: 8, ageMax: 13, difficulty: 3,
  rows: [
    ["A baker has 12 cupcakes and gives 5 away. How many are left?", "7", "5", "17", "12"],
    ["Lila has 3 boxes with 4 crayons each. How many crayons total?", "12", "7", "16", "20"],
    ["A bus has 20 seats. 13 are taken. How many empty?", "7", "13", "33", "10"],
    ["You buy a book for $8 and a pen for $3. Total?", "$11", "$5", "$83", "$10"],
    ["A pizza is cut into 8 slices. You eat 3. How many left?", "5", "3", "8", "11"],
    ["You walk 2 miles each day. How far in 5 days?", "10 miles", "5 miles", "7 miles", "25 miles"],
    ["A garden has 9 rows of 6 carrots. How many carrots?", "54", "15", "45", "63"],
    ["12 cookies are shared between 4 kids equally. How many each?", "3", "4", "8", "16"],
    ["A train leaves at 3:00 and arrives at 5:30. How long is the trip?", "2 hours 30 minutes", "1 hour 30 minutes", "3 hours", "8 hours 30 minutes"],
    ["A pencil costs 25¢. You have $1. How many can you buy?", "4", "3", "5", "25"],
    ["You start with 50 and add 17. What do you get?", "67", "33", "57", "117"],
    ["You start with 100 and lose 23. What do you have?", "77", "67", "87", "123"],
    ["A book has 200 pages. You read 60. What fraction is that?", "3/10", "1/3", "1/2", "60/100"],
    ["What number comes next? 2, 4, 6, 8, ?", "10", "9", "12", "16"],
    ["What number comes next? 5, 10, 15, 20, ?", "25", "21", "30", "100"],
    ["Which is the odd one out? 2, 4, 7, 8?", "7", "2", "4", "8"],
    ["A square has 4 sides. A pentagon has how many?", "5", "3", "6", "8"],
    ["A triangle has how many sides?", "3", "2", "4", "5"],
    ["A hexagon has how many sides?", "6", "5", "7", "8"],
    ["A circle has how many corners?", "0", "1", "2", "infinity"],
  ],
};

// ─── Animals (5-9) ──────────────────────────────────────────────────────────
const animals1: Pack = {
  subject: "animals", ageMin: 5, ageMax: 9, difficulty: 1,
  rows: [
    ["What sound does a cow make?", "Moo", "Meow", "Bark", "Roar"],
    ["What sound does a dog make?", "Bark", "Moo", "Cluck", "Tweet"],
    ["What sound does a duck make?", "Quack", "Bark", "Roar", "Hiss"],
    ["What sound does a horse make?", "Neigh", "Bark", "Meow", "Moo"],
    ["What sound does a sheep make?", "Baa", "Bark", "Quack", "Cluck"],
    ["What sound does a chicken make?", "Cluck", "Bark", "Roar", "Hiss"],
    ["What sound does a lion make?", "Roar", "Bark", "Quack", "Cluck"],
    ["What sound does a snake make?", "Hiss", "Bark", "Roar", "Tweet"],
    ["Which animal lives in the ocean?", "Shark", "Lion", "Cow", "Eagle"],
    ["Which animal can fly?", "Eagle", "Cow", "Fish", "Snake"],
    ["How many legs does a spider have?", "8", "6", "4", "10"],
    ["How many legs does an insect have?", "6", "4", "8", "10"],
    ["Which animal carries a baby in a pouch?", "Kangaroo", "Lion", "Tiger", "Rabbit"],
    ["What is a baby cat called?", "Kitten", "Puppy", "Cub", "Foal"],
    ["What is a baby dog called?", "Puppy", "Kitten", "Cub", "Calf"],
    ["What is a baby horse called?", "Foal", "Kitten", "Cub", "Lamb"],
    ["What is a baby sheep called?", "Lamb", "Foal", "Calf", "Cub"],
    ["What is a baby cow called?", "Calf", "Pup", "Lamb", "Kit"],
    ["What is a baby bear called?", "Cub", "Pup", "Calf", "Foal"],
    ["What is a baby frog called?", "Tadpole", "Larva", "Pup", "Caterpillar"],
    ["Which animal has a long trunk?", "Elephant", "Giraffe", "Lion", "Zebra"],
    ["Which animal has black and white stripes?", "Zebra", "Lion", "Tiger", "Elephant"],
    ["Which animal has orange and black stripes?", "Tiger", "Zebra", "Leopard", "Cheetah"],
    ["Which animal is the king of the jungle?", "Lion", "Tiger", "Bear", "Wolf"],
    ["Which animal has a hump on its back?", "Camel", "Horse", "Giraffe", "Cow"],
    ["Which animal is the tallest?", "Giraffe", "Elephant", "Horse", "Zebra"],
    ["Which animal is the largest on land?", "Elephant", "Lion", "Tiger", "Cow"],
    ["Which animal lives in a hive?", "Bee", "Ant", "Spider", "Bird"],
    ["Which animal builds dams?", "Beaver", "Otter", "Raccoon", "Fox"],
    ["Which animal hibernates in winter?", "Bear", "Lion", "Cow", "Horse"],
  ],
};

// ─── Animals (8-12) ─────────────────────────────────────────────────────────
const animals2: Pack = {
  subject: "animals", ageMin: 8, ageMax: 12, difficulty: 2,
  rows: [
    ["What is the largest animal on Earth?", "Blue whale", "Elephant", "Giraffe", "Shark"],
    ["What is the fastest land animal?", "Cheetah", "Horse", "Lion", "Greyhound"],
    ["Which bird cannot fly?", "Penguin", "Eagle", "Sparrow", "Hawk"],
    ["Which mammal lays eggs?", "Platypus", "Whale", "Bat", "Squirrel"],
    ["What is a group of lions called?", "Pride", "Pack", "Herd", "Flock"],
    ["What is a group of wolves called?", "Pack", "Pride", "School", "Swarm"],
    ["What is a group of fish called?", "School", "Pack", "Pride", "Herd"],
    ["What is a group of crows called?", "Murder", "Pack", "School", "Hive"],
    ["What is a group of bees called?", "Swarm", "Pack", "Pride", "Pod"],
    ["Which dinosaur was a meat-eater?", "T-Rex", "Triceratops", "Brachiosaurus", "Stegosaurus"],
    ["Which is a reptile?", "Lizard", "Frog", "Salmon", "Owl"],
    ["Which is an amphibian?", "Frog", "Lizard", "Snake", "Turtle"],
    ["How long do elephants live (about)?", "60-70 years", "10 years", "20 years", "200 years"],
    ["Which animal is called the ship of the desert?", "Camel", "Horse", "Donkey", "Lion"],
    ["What does a panda eat mostly?", "Bamboo", "Meat", "Fish", "Honey"],
    ["What do butterflies drink?", "Nectar", "Water", "Milk", "Blood"],
    ["Where do polar bears live?", "Arctic", "Antarctica", "Africa", "Australia"],
    ["Where do kangaroos live in the wild?", "Australia", "Africa", "Asia", "South America"],
    ["Where do pandas live in the wild?", "China", "India", "Africa", "Brazil"],
    ["What is the smallest bird?", "Hummingbird", "Sparrow", "Wren", "Robin"],
    ["What animal makes a web to catch food?", "Spider", "Bee", "Ant", "Bat"],
    ["Which sea creature has 8 arms?", "Octopus", "Squid", "Starfish", "Crab"],
    ["What does a frog turn into from a tadpole?", "Frog", "Toad", "Lizard", "Snake"],
    ["Which is NOT a reptile?", "Frog", "Snake", "Lizard", "Crocodile"],
    ["Which animal is a marsupial?", "Koala", "Beaver", "Otter", "Squirrel"],
    ["What does a giraffe eat?", "Leaves", "Meat", "Grass", "Fish"],
    ["Which animal has a shell on its back?", "Turtle", "Frog", "Lizard", "Mouse"],
    ["What's the name of the longest snake?", "Reticulated python", "Cobra", "Rattlesnake", "Garter snake"],
    ["Which whale has a horn-like tusk?", "Narwhal", "Blue whale", "Orca", "Humpback"],
    ["Which bird is the symbol of the USA?", "Bald eagle", "Owl", "Hawk", "Sparrow"],
  ],
};

// ─── Geography: world (8-13) ────────────────────────────────────────────────
const geography1: Pack = {
  subject: "geography", ageMin: 8, ageMax: 13, difficulty: 2,
  rows: [
    ["What is the capital of France?", "Paris", "London", "Berlin", "Rome"],
    ["What is the capital of Italy?", "Rome", "Milan", "Venice", "Naples"],
    ["What is the capital of Spain?", "Madrid", "Barcelona", "Lisbon", "Seville"],
    ["What is the capital of the United Kingdom?", "London", "Manchester", "Edinburgh", "Dublin"],
    ["What is the capital of Germany?", "Berlin", "Munich", "Hamburg", "Frankfurt"],
    ["What is the capital of Japan?", "Tokyo", "Osaka", "Kyoto", "Seoul"],
    ["What is the capital of China?", "Beijing", "Shanghai", "Hong Kong", "Tokyo"],
    ["What is the capital of Australia?", "Canberra", "Sydney", "Melbourne", "Perth"],
    ["What is the capital of Canada?", "Ottawa", "Toronto", "Vancouver", "Montreal"],
    ["What is the capital of Brazil?", "Brasília", "Rio de Janeiro", "São Paulo", "Salvador"],
    ["What is the capital of Mexico?", "Mexico City", "Cancún", "Guadalajara", "Tijuana"],
    ["What is the capital of Egypt?", "Cairo", "Alexandria", "Giza", "Luxor"],
    ["What is the capital of India?", "New Delhi", "Mumbai", "Kolkata", "Bangalore"],
    ["What is the capital of Russia?", "Moscow", "St. Petersburg", "Kazan", "Sochi"],
    ["What is the capital of Argentina?", "Buenos Aires", "Mendoza", "Córdoba", "Rosario"],
    ["Which is the largest ocean?", "Pacific", "Atlantic", "Indian", "Arctic"],
    ["Which is the longest river?", "Nile", "Amazon", "Mississippi", "Yangtze"],
    ["Which continent is the largest?", "Asia", "Africa", "Europe", "North America"],
    ["Which continent is the smallest?", "Australia", "Europe", "Antarctica", "South America"],
    ["Which is the highest mountain?", "Mount Everest", "K2", "Kilimanjaro", "Mont Blanc"],
    ["Which desert is the largest?", "Antarctic", "Sahara", "Gobi", "Arabian"],
    ["How many continents are there?", "7", "5", "6", "8"],
    ["How many oceans are there?", "5", "4", "6", "7"],
    ["Which country has the largest population?", "India", "China", "USA", "Russia"],
    ["Which country has the most time zones?", "Russia", "USA", "China", "Brazil"],
    ["What country are pyramids most famous in?", "Egypt", "Greece", "Mexico", "Italy"],
    ["The Eiffel Tower is in which city?", "Paris", "London", "Berlin", "Rome"],
    ["Which sea separates Europe and Africa?", "Mediterranean", "Caspian", "Black", "Red"],
    ["Which country is shaped like a boot?", "Italy", "Spain", "Greece", "Norway"],
    ["The Great Wall is in which country?", "China", "Japan", "India", "Mongolia"],
  ],
};

// ─── Geography: USA & states (7-13) ─────────────────────────────────────────
const geography2: Pack = {
  subject: "geography", ageMin: 7, ageMax: 13, difficulty: 2,
  rows: [
    ["What is the capital of the USA?", "Washington, D.C.", "New York", "Los Angeles", "Chicago"],
    ["What is the capital of California?", "Sacramento", "Los Angeles", "San Francisco", "San Diego"],
    ["What is the capital of Texas?", "Austin", "Houston", "Dallas", "San Antonio"],
    ["What is the capital of Florida?", "Tallahassee", "Miami", "Orlando", "Jacksonville"],
    ["What is the capital of New York?", "Albany", "New York City", "Buffalo", "Rochester"],
    ["How many states are in the USA?", "50", "48", "52", "13"],
    ["Which state is shaped like a hand?", "Michigan", "Florida", "Texas", "Ohio"],
    ["Which is the smallest US state?", "Rhode Island", "Delaware", "Connecticut", "Hawaii"],
    ["Which is the largest US state?", "Alaska", "Texas", "California", "Montana"],
    ["Which state is famous for Hollywood?", "California", "New York", "Florida", "Nevada"],
    ["Which river runs through the Grand Canyon?", "Colorado", "Mississippi", "Hudson", "Rio Grande"],
    ["Which lake is between the USA and Canada?", "Lake Superior", "Lake Tahoe", "Lake Placid", "Lake Michigan"],
    ["The Statue of Liberty is in which city?", "New York", "Washington D.C.", "Boston", "Philadelphia"],
    ["Which state grows the most oranges?", "Florida", "Texas", "California", "Georgia"],
    ["Which state is called the Sunshine State?", "Florida", "California", "Hawaii", "Arizona"],
    ["Which state is called the Lone Star State?", "Texas", "California", "Alaska", "Florida"],
    ["What state are the Rocky Mountains mostly in?", "Colorado", "Maine", "Florida", "Hawaii"],
    ["Which state is north of California?", "Oregon", "Nevada", "Arizona", "Texas"],
    ["The Mississippi River flows mostly which direction?", "South", "North", "East", "West"],
    ["What ocean is east of the USA?", "Atlantic", "Pacific", "Indian", "Arctic"],
  ],
};

// ─── Science: basics (6-10) ─────────────────────────────────────────────────
const scienceA: Pack = {
  subject: "science", ageMin: 6, ageMax: 10, difficulty: 1,
  rows: [
    ["How many days in a week?", "7", "5", "6", "10"],
    ["How many seasons are there?", "4", "2", "3", "12"],
    ["How many planets are in our solar system?", "8", "7", "9", "10"],
    ["What is the sun?", "A star", "A planet", "A moon", "A comet"],
    ["What is Earth's only natural satellite?", "The Moon", "The Sun", "Mars", "Jupiter"],
    ["What is the closest planet to the sun?", "Mercury", "Venus", "Earth", "Mars"],
    ["What is the largest planet?", "Jupiter", "Saturn", "Earth", "Neptune"],
    ["What planet do we live on?", "Earth", "Mars", "Venus", "Saturn"],
    ["What planet is famous for its rings?", "Saturn", "Jupiter", "Earth", "Mars"],
    ["What is the red planet?", "Mars", "Venus", "Mercury", "Pluto"],
    ["What gas do we breathe in?", "Oxygen", "Carbon dioxide", "Nitrogen", "Helium"],
    ["What gas do plants breathe in?", "Carbon dioxide", "Oxygen", "Helium", "Methane"],
    ["What do plants need to make food?", "Sunlight", "Darkness", "Cold", "Salt"],
    ["What do we call ice when it melts?", "Water", "Steam", "Air", "Salt"],
    ["What is rain made of?", "Water", "Air", "Dust", "Sand"],
    ["What is a rainbow made of?", "Sunlight and water", "Stars", "Smoke", "Snow"],
    ["What organ pumps blood?", "Heart", "Lung", "Liver", "Brain"],
    ["What organ helps us think?", "Brain", "Heart", "Stomach", "Skin"],
    ["What are our biggest organs?", "Skin", "Brain", "Heart", "Eyes"],
    ["How many bones do adults have (about)?", "206", "100", "300", "1000"],
    ["What is H2O?", "Water", "Oxygen", "Salt", "Carbon"],
    ["What freezes water?", "Cold", "Heat", "Sun", "Wind"],
    ["What boils water?", "Heat", "Cold", "Salt", "Sand"],
    ["What does a magnet attract?", "Iron", "Wood", "Plastic", "Glass"],
    ["What do we use to see stars far away?", "Telescope", "Microscope", "Mirror", "Magnet"],
    ["What do we use to see tiny things?", "Microscope", "Telescope", "Binoculars", "Glasses"],
  ],
};

// ─── Science: nature & body (9-13) ──────────────────────────────────────────
const scienceB: Pack = {
  subject: "science", ageMin: 9, ageMax: 13, difficulty: 3,
  rows: [
    ["Photosynthesis turns sunlight, water, and CO2 into…?", "Sugar and oxygen", "Salt and water", "Iron and rust", "Steam and gas"],
    ["Which body system pumps blood?", "Circulatory", "Digestive", "Nervous", "Skeletal"],
    ["Which organ filters blood?", "Kidney", "Brain", "Lung", "Heart"],
    ["Which animal cell part stores DNA?", "Nucleus", "Cytoplasm", "Wall", "Vacuole"],
    ["Which planet has the strongest gravity?", "Jupiter", "Earth", "Mercury", "Mars"],
    ["What's the unit of electric current?", "Ampere", "Volt", "Watt", "Ohm"],
    ["What's the speed of light (about)?", "300,000 km/s", "30 km/s", "3,000 km/s", "30,000,000 km/s"],
    ["Which is a noble gas?", "Helium", "Oxygen", "Nitrogen", "Hydrogen"],
    ["What's the chemical symbol for gold?", "Au", "Go", "Gd", "Ag"],
    ["What's the chemical symbol for silver?", "Ag", "Sl", "Si", "Au"],
    ["What's the chemical symbol for iron?", "Fe", "Ir", "In", "I"],
    ["What's the chemical symbol for sodium?", "Na", "So", "Sd", "Si"],
    ["What scientist discovered gravity (legend)?", "Isaac Newton", "Albert Einstein", "Galileo", "Tesla"],
    ["What scientist proposed E=mc²?", "Einstein", "Newton", "Curie", "Bohr"],
    ["What's the boiling point of water (Celsius)?", "100", "0", "50", "212"],
    ["What's the freezing point of water (Celsius)?", "0", "32", "100", "-10"],
    ["How many bones are in the human hand?", "27", "10", "15", "100"],
    ["What's the strongest sense in dogs?", "Smell", "Sight", "Hearing", "Touch"],
    ["What's the largest planet's giant storm?", "Great Red Spot", "Big Eye", "Storm 9", "Saturn's Eye"],
    ["What's an animal with a backbone called?", "Vertebrate", "Invertebrate", "Amphibian", "Mammal"],
    ["Which is NOT a state of matter?", "Energy", "Solid", "Liquid", "Gas"],
    ["What kind of wave is sound?", "Mechanical", "Light", "Radio", "Magnetic"],
    ["The brightest star in our sky is…?", "The Sun", "Sirius", "Polaris", "Betelgeuse"],
    ["Which animal has the fastest heart?", "Hummingbird", "Cheetah", "Mouse", "Dog"],
    ["What gas is most common in Earth's air?", "Nitrogen", "Oxygen", "Carbon dioxide", "Argon"],
  ],
};

// ─── History (8-13) ─────────────────────────────────────────────────────────
const historyA: Pack = {
  subject: "history", ageMin: 8, ageMax: 13, difficulty: 2,
  rows: [
    ["Who was the first US president?", "George Washington", "Abraham Lincoln", "Thomas Jefferson", "John Adams"],
    ["Who wrote the Declaration of Independence (mainly)?", "Thomas Jefferson", "George Washington", "Ben Franklin", "John Adams"],
    ["In what year did Columbus reach the Americas?", "1492", "1066", "1620", "1776"],
    ["In what year did the USA declare independence?", "1776", "1492", "1812", "1865"],
    ["Who flew the first airplane (1903)?", "The Wright Brothers", "Edison", "Bell", "Tesla"],
    ["Who painted the Mona Lisa?", "Leonardo da Vinci", "Michelangelo", "Picasso", "Raphael"],
    ["Who discovered penicillin?", "Alexander Fleming", "Marie Curie", "Edison", "Pasteur"],
    ["Who was the first person on the moon?", "Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "John Glenn"],
    ["What ancient civilization built the pyramids of Giza?", "Egyptian", "Roman", "Greek", "Mayan"],
    ["What language did the Romans speak?", "Latin", "Greek", "Italian", "French"],
    ["Who was a famous queen of Egypt?", "Cleopatra", "Nefertiti (also okay)", "Elizabeth", "Victoria"],
    ["What event happened in 1969 in space?", "Moon landing", "Mars landing", "First satellite", "Hubble launch"],
    ["Who led India to independence peacefully?", "Mahatma Gandhi", "Nehru", "Tagore", "Patel"],
    ["What was the Renaissance?", "Rebirth of art and learning", "A war", "A plague", "A continent"],
    ["Who wrote Romeo and Juliet?", "William Shakespeare", "Mark Twain", "Charles Dickens", "Jane Austen"],
    ["Who invented the lightbulb (best known)?", "Thomas Edison", "Tesla", "Newton", "Bell"],
    ["Who invented the telephone?", "Alexander Graham Bell", "Edison", "Tesla", "Marconi"],
    ["What was the Titanic?", "A ship that sank in 1912", "A pyramid", "A castle", "A planet"],
    ["What ended in 1945?", "World War II", "World War I", "The Cold War", "The Civil War"],
    ["Who was president during the US Civil War?", "Abraham Lincoln", "Washington", "Jefferson", "Roosevelt"],
    ["Which civilization built Machu Picchu?", "Inca", "Aztec", "Maya", "Olmec"],
    ["Who painted the Sistine Chapel ceiling?", "Michelangelo", "Da Vinci", "Raphael", "Donatello"],
    ["What's the longest-reigning UK monarch (record)?", "Queen Elizabeth II", "Queen Victoria", "King George III", "Henry VIII"],
    ["What is the Magna Carta?", "An early charter of rights", "A pyramid", "A queen", "A river"],
    ["Who freed enslaved people in the US during the Civil War?", "Abraham Lincoln", "George Washington", "Theodore Roosevelt", "Franklin Roosevelt"],
  ],
};

// ─── Words / Vocabulary (6-10) ──────────────────────────────────────────────
const wordsA: Pack = {
  subject: "words", ageMin: 6, ageMax: 10, difficulty: 1,
  rows: [
    ["What is the opposite of hot?", "Cold", "Warm", "Wet", "Tall"],
    ["What is the opposite of big?", "Small", "Large", "Tall", "Wide"],
    ["What is the opposite of fast?", "Slow", "Quick", "Tall", "Loud"],
    ["What is the opposite of happy?", "Sad", "Angry", "Calm", "Excited"],
    ["What is the opposite of up?", "Down", "Left", "Out", "Around"],
    ["What is the opposite of full?", "Empty", "Half", "Light", "Heavy"],
    ["What is the opposite of bright?", "Dark", "Loud", "Dim (also okay)", "Heavy"],
    ["Which word means scared?", "Afraid", "Happy", "Tired", "Hungry"],
    ["Which word means very small?", "Tiny", "Huge", "Loud", "Heavy"],
    ["Which word means look at?", "See", "Eat", "Run", "Sleep"],
    ["What is a synonym for happy?", "Joyful", "Sad", "Angry", "Tired"],
    ["What is a synonym for big?", "Huge", "Tiny", "Quick", "Sweet"],
    ["What is the plural of mouse?", "Mice", "Mouses", "Mouse", "Mices"],
    ["What is the plural of child?", "Children", "Childs", "Childes", "Childies"],
    ["What is the plural of foot?", "Feet", "Foots", "Footses", "Feets"],
    ["What is the plural of tooth?", "Teeth", "Tooths", "Toothes", "Tooth"],
    ["What is the plural of leaf?", "Leaves", "Leafs", "Leafes", "Leavies"],
    ["Which is a noun?", "Apple", "Run", "Quickly", "Above"],
    ["Which is a verb?", "Jump", "Apple", "Quickly", "Bright"],
    ["Which is an adjective?", "Bright", "Jump", "Apple", "Slowly"],
    ["A small body of water is a…?", "Pond", "Mountain", "Tree", "Cloud"],
    ["A young flower grows from a…?", "Seed", "Stone", "Cloud", "Egg"],
    ["A baby tree is a…?", "Seedling (also okay)", "Sapling", "Root", "Trunk"],
    ["What's a place where you borrow books?", "Library", "Bakery", "Garage", "Park"],
    ["What's a meal you eat in the morning?", "Breakfast", "Lunch", "Dinner", "Snack"],
    ["What's a meal in the middle of the day?", "Lunch", "Breakfast", "Dinner", "Snack"],
    ["What's a meal at the end of the day?", "Dinner", "Breakfast", "Lunch", "Snack"],
    ["A baby bird hatches from an…?", "Egg", "Apple", "Seed", "Stone"],
    ["A baby kangaroo is called a…?", "Joey", "Cub", "Pup", "Calf"],
    ["A group of singers is a…?", "Choir", "Band", "Crowd", "Class"],
  ],
};

// ─── Words: Spelling (7-12) ─────────────────────────────────────────────────
const wordsB: Pack = {
  subject: "words", ageMin: 7, ageMax: 12, difficulty: 2,
  rows: [
    ["Which word is spelled correctly?", "Necessary", "Necesary", "Neccesary", "Necesarry"],
    ["Which word is spelled correctly?", "Believe", "Beleive", "Believ", "Beleeve"],
    ["Which word is spelled correctly?", "Friend", "Freind", "Frend", "Friende"],
    ["Which word is spelled correctly?", "Beautiful", "Beautifull", "Beuatiful", "Beautifle"],
    ["Which word is spelled correctly?", "Separate", "Seperate", "Separete", "Seperete"],
    ["Which word is spelled correctly?", "Definitely", "Definately", "Definatly", "Defenitely"],
    ["Which word is spelled correctly?", "Tomorrow", "Tommorow", "Tommorrow", "Tomorow"],
    ["Which word is spelled correctly?", "Surprise", "Suprise", "Surprize", "Suprize"],
    ["Which word is spelled correctly?", "Interesting", "Intresting", "Intersting", "Interestting"],
    ["Which word is spelled correctly?", "Restaurant", "Resturant", "Restraunt", "Restorant"],
    ["Which word is spelled correctly?", "Vacuum", "Vaccum", "Vacume", "Vacuume"],
    ["Which word is spelled correctly?", "Embarrass", "Embarass", "Embaras", "Embarras"],
    ["Which word is spelled correctly?", "Library", "Libary", "Liberary", "Libraray"],
    ["Which word is spelled correctly?", "February", "Febuary", "Febyuary", "Feburary"],
    ["Which word is spelled correctly?", "Wednesday", "Wendesday", "Wensday", "Wenesday"],
    ["Pick the correct word: 'Their / There / They're going home.'", "They're", "Their", "There", "Thier"],
    ["Pick the correct word: 'You're / Your hat is nice.'", "Your", "You're", "Yore", "Youre"],
    ["Pick the correct word: 'Its / It's going to rain.'", "It's", "Its", "Its'", "It is's"],
    ["Pick the correct word: 'Loose / Lose your keys.'", "Lose", "Loose", "Looze", "Lozze"],
    ["Pick the correct word: 'Affect / Effect changes the result.'", "Affect", "Effect", "Affekt", "Efect"],
  ],
};

// ─── Reading comprehension snippets (8-12) ─────────────────────────────────
const reading: Pack = {
  subject: "reading", ageMin: 8, ageMax: 12, difficulty: 2,
  rows: [
    ["Aesop's Fables are best described as…?", "Short stories with a lesson", "Long novels", "Poems", "Songs"],
    ["What's the moral of 'The Tortoise and the Hare'?", "Slow and steady wins the race", "Be loud", "Always sleep", "Don't run"],
    ["Who wrote Charlotte's Web?", "E.B. White", "Roald Dahl", "Dr. Seuss", "C.S. Lewis"],
    ["Who wrote Matilda?", "Roald Dahl", "E.B. White", "J.K. Rowling", "Beverly Cleary"],
    ["Who wrote Harry Potter?", "J.K. Rowling", "Roald Dahl", "C.S. Lewis", "Tolkien"],
    ["Who wrote The Hobbit?", "J.R.R. Tolkien", "C.S. Lewis", "J.K. Rowling", "Tolstoy"],
    ["Who wrote The Lion, the Witch and the Wardrobe?", "C.S. Lewis", "Tolkien", "Rowling", "Dahl"],
    ["Who wrote Charlie and the Chocolate Factory?", "Roald Dahl", "Dr. Seuss", "E.B. White", "Beverly Cleary"],
    ["What is a synonym for 'said' in writing?", "Whispered", "Wrote", "Watched", "Walked"],
    ["A character is the…?", "Person in the story", "Place where it happens", "Lesson at the end", "Title"],
    ["The setting of a story is the…?", "Place and time", "Main person", "Title page", "Dialogue"],
    ["The plot is the…?", "Series of events", "Main person", "Place", "Cover"],
    ["A genre is a…?", "Type of story", "Title", "Author's name", "Picture"],
    ["A simile uses…?", "'Like' or 'as'", "All caps", "A list", "A question mark"],
    ["A metaphor compares two things by…?", "Saying one IS the other", "Asking a question", "Listing", "Singing"],
    ["Onomatopoeia means…?", "Words that sound like the noise they describe", "Big words", "Old words", "Made-up names"],
  ],
};

// ─── Riddles & lateral thinking (8-12) ─────────────────────────────────────
const riddles: Pack = {
  subject: "riddles", ageMin: 8, ageMax: 12, difficulty: 3,
  rows: [
    ["I have hands but cannot clap. What am I?", "A clock", "A tree", "A book", "A river"],
    ["I have keys but no locks. What am I?", "A keyboard", "A cage", "A car", "A door"],
    ["What gets wetter the more it dries?", "A towel", "A rock", "A book", "A sponge (also okay)"],
    ["What has to be broken before you can use it?", "An egg", "A pencil", "A door", "A book"],
    ["The more you take, the more you leave behind. What?", "Footsteps", "Pages", "Coins", "Memories"],
    ["I'm tall when young and short when old. What am I?", "A candle", "A tree", "A person", "A river"],
    ["What goes up but never comes down?", "Your age", "Rain", "A ball", "The sun"],
    ["What has cities but no houses, forests but no trees?", "A map", "A book", "A dream", "A globe"],
    ["What word is spelled wrong in every dictionary?", "Wrong", "Right", "Spell", "Word"],
    ["I run but never walk. I have a mouth but never talk. What am I?", "A river", "A clock", "A baby", "A song"],
    ["What can you catch but not throw?", "A cold", "A ball", "A fish", "A pen"],
    ["What has many teeth but cannot bite?", "A comb", "A saw (also okay)", "A zipper (also okay)", "A door"],
    ["I have a face and two hands but no arms or legs. What am I?", "A clock", "A coin", "A doll", "A photo"],
    ["What goes around the world but stays in a corner?", "A stamp", "A car", "A bird", "A clock"],
    ["What has a thumb and four fingers but isn't alive?", "A glove", "A statue", "A doll", "A drawing"],
    ["What can travel around the world while staying in the same spot?", "A stamp", "A ship", "A balloon", "A train"],
    ["What word becomes shorter when you add two letters?", "Short", "Word", "Letter", "Add"],
    ["What has eyes but cannot see?", "A potato", "A clock", "A book", "A door"],
    ["What flies without wings?", "Time", "A balloon", "A plane", "A bird"],
    ["What has one head, one foot, and four legs?", "A bed", "A table", "A chair", "A dog"],
  ],
};

// ─── Logic puzzles (9-13) ───────────────────────────────────────────────────
const logic: Pack = {
  subject: "logic", ageMin: 9, ageMax: 13, difficulty: 3,
  rows: [
    ["If all roses are flowers and some flowers fade quickly, can we say all roses fade quickly?", "No", "Yes", "Maybe", "Sometimes"],
    ["A is older than B. B is older than C. Who's the oldest?", "A", "B", "C", "Cannot tell"],
    ["If today is Tuesday, what day is it 3 days later?", "Friday", "Thursday", "Saturday", "Sunday"],
    ["If today is Sunday, what day is it 7 days later?", "Sunday", "Monday", "Saturday", "Tuesday"],
    ["Which doesn't belong: cat, dog, fish, car?", "Car", "Cat", "Dog", "Fish"],
    ["Which doesn't belong: apple, banana, broccoli, orange?", "Broccoli", "Apple", "Banana", "Orange"],
    ["Which doesn't belong: square, circle, triangle, pencil?", "Pencil", "Square", "Circle", "Triangle"],
    ["What number is missing? 2, 4, _, 8, 10", "6", "5", "7", "12"],
    ["What number is missing? 1, 3, 5, _, 9", "7", "6", "8", "10"],
    ["What number is missing? 10, 20, 30, _, 50", "40", "35", "45", "60"],
    ["Continue the pattern: A, C, E, G, ?", "I", "H", "J", "K"],
    ["Continue the pattern: 1, 2, 4, 8, ?", "16", "10", "12", "20"],
    ["Continue the pattern: 100, 90, 80, 70, ?", "60", "65", "75", "0"],
    ["3 socks: 1 red, 1 blue, 1 green. Pick 2 in the dark — chance both are red?", "0", "1/2", "1/3", "1"],
    ["You have 5 apples and give away 3. How many do you HAVE?", "2", "3", "5", "8"],
    ["You have 5 apples and TAKE 3 from a friend. How many do you have?", "8", "2", "3", "5"],
    ["Which weighs more: a pound of feathers or a pound of bricks?", "They weigh the same", "Bricks", "Feathers", "Cannot tell"],
    ["A clock shows 12:00. What angle is between the hands?", "0 degrees", "90 degrees", "180 degrees", "360 degrees"],
    ["Two trains travel toward each other. They meet halfway. They are equally fast. Who travels longer?", "Both the same", "First train", "Second train", "Cannot tell"],
    ["Three apples and three oranges are mixed. How many fruits?", "6", "3", "9", "12"],
  ],
};

// ─── Art & Music (8-13) ─────────────────────────────────────────────────────
const artMusic: Pack = {
  subject: "art", ageMin: 8, ageMax: 13, difficulty: 2,
  rows: [
    ["Who painted Starry Night?", "Vincent van Gogh", "Monet", "Picasso", "Da Vinci"],
    ["Who painted The Persistence of Memory (melting clocks)?", "Salvador Dalí", "Picasso", "Warhol", "Monet"],
    ["What art style did Picasso help start?", "Cubism", "Impressionism", "Realism", "Pointillism"],
    ["Which is a primary color?", "Red", "Green", "Orange", "Purple"],
    ["Mixing red and blue makes…?", "Purple", "Green", "Orange", "Pink"],
    ["Mixing red and yellow makes…?", "Orange", "Purple", "Green", "Brown"],
    ["Mixing blue and yellow makes…?", "Green", "Purple", "Orange", "Brown"],
    ["What is a sculpture?", "A 3D artwork", "A song", "A poem", "A drawing"],
    ["A self-portrait is a picture of…?", "Yourself", "A friend", "A landscape", "A still life"],
    ["A landscape painting shows…?", "Outdoor scenery", "A face", "A still object", "A pattern"],
  ],
};
const musicPack: Pack = {
  subject: "music", ageMin: 8, ageMax: 13, difficulty: 2,
  rows: [
    ["How many keys are on a standard piano?", "88", "76", "100", "60"],
    ["A guitar usually has how many strings?", "6", "4", "5", "12"],
    ["A violin has how many strings?", "4", "6", "5", "8"],
    ["Which is a brass instrument?", "Trumpet", "Violin", "Flute", "Drums"],
    ["Which is a string instrument?", "Cello", "Trumpet", "Drum", "Flute"],
    ["Which is a woodwind?", "Clarinet", "Trumpet", "Drum", "Cello"],
    ["Who wrote 'Twinkle Twinkle Little Star' (often credited)?", "A French folk tune", "Beethoven", "Bach", "Mozart"],
    ["Who composed 'Für Elise'?", "Beethoven", "Mozart", "Chopin", "Bach"],
    ["Who composed 'The Four Seasons'?", "Vivaldi", "Bach", "Beethoven", "Mozart"],
    ["What instrument has a bow you can drag across strings?", "Violin", "Piano", "Guitar", "Drum"],
    ["What's a soft singing word for 'quiet'?", "Piano", "Forte", "Allegro", "Presto"],
    ["What's a music word for 'loud'?", "Forte", "Piano", "Largo", "Adagio"],
    ["How many lines are on a music staff?", "5", "4", "6", "10"],
    ["A note shorter than a quarter note is a…?", "Eighth note", "Half note", "Whole note", "Long note"],
    ["A piece of music that uses voices is a…?", "Chorus (or song)", "Symphony", "Sonata", "Concerto"],
  ],
};

// ─── Sports (8-13) ──────────────────────────────────────────────────────────
const sports: Pack = {
  subject: "sports", ageMin: 8, ageMax: 13, difficulty: 2,
  rows: [
    ["How many players on a soccer team (on field)?", "11", "9", "10", "12"],
    ["How many players on a basketball team (on court)?", "5", "6", "7", "9"],
    ["How many players on a baseball team (on field)?", "9", "10", "11", "8"],
    ["A soccer match has how many halves?", "2", "3", "4", "1"],
    ["A basketball game has how many quarters (NBA)?", "4", "3", "2", "5"],
    ["Three strikes and you're…?", "Out", "Done", "Safe", "Up"],
    ["A 'goal' in soccer is worth how many points?", "1", "2", "3", "6"],
    ["A 'home run' is in which sport?", "Baseball", "Basketball", "Soccer", "Football"],
    ["A 'touchdown' is in which sport?", "American football", "Soccer", "Hockey", "Tennis"],
    ["A 'birdie' is a term in which sport?", "Golf", "Tennis", "Bowling", "Soccer"],
    ["A 'love' score is in which sport?", "Tennis", "Bowling", "Golf", "Soccer"],
    ["The Olympic Games happen every…?", "4 years", "2 years", "1 year", "10 years"],
    ["Which sport uses a wooden bat?", "Baseball", "Soccer", "Basketball", "Cricket (also okay)"],
    ["Which sport uses a puck?", "Hockey", "Tennis", "Soccer", "Lacrosse"],
    ["Which sport plays at Wimbledon?", "Tennis", "Cricket", "Football", "Polo"],
    ["A marathon is about how many miles?", "26.2", "5", "10", "100"],
    ["The fastest swim stroke is…?", "Freestyle", "Breaststroke", "Backstroke", "Butterfly"],
    ["The Tour de France is in which sport?", "Cycling", "Running", "Skiing", "Swimming"],
    ["Pelé played which sport?", "Soccer", "Basketball", "Tennis", "Golf"],
    ["Michael Jordan played which sport?", "Basketball", "Baseball", "Football", "Soccer"],
  ],
};

// ─── General knowledge (7-12) ───────────────────────────────────────────────
const generalA: Pack = {
  subject: "general", ageMin: 7, ageMax: 12, difficulty: 2,
  rows: [
    ["How many colors are in a rainbow?", "7", "5", "6", "10"],
    ["What are the 7 rainbow colors in order?", "ROYGBIV", "RGB", "RYB", "RYGCBV"],
    ["How many minutes in an hour?", "60", "30", "100", "24"],
    ["How many hours in a day?", "24", "12", "60", "100"],
    ["How many days in a year (non-leap)?", "365", "364", "366", "360"],
    ["How many days in a leap year?", "366", "365", "360", "367"],
    ["How many months in a year?", "12", "10", "11", "13"],
    ["What month has 28/29 days?", "February", "March", "April", "May"],
    ["Which month is shortest?", "February", "January", "March", "April"],
    ["What's the biggest mammal?", "Blue whale", "Elephant", "Polar bear", "Walrus"],
    ["What's the smallest planet?", "Mercury", "Mars", "Pluto", "Earth"],
    ["What's the only planet known to have life?", "Earth", "Mars", "Venus", "Jupiter"],
    ["How many letters in the English alphabet?", "26", "24", "27", "30"],
    ["What's the first letter of the alphabet?", "A", "B", "Z", "M"],
    ["What's the last letter of the alphabet?", "Z", "Y", "X", "A"],
    ["A dozen is how many?", "12", "10", "20", "13"],
    ["Half a dozen is how many?", "6", "5", "12", "3"],
    ["A century is how many years?", "100", "10", "1000", "50"],
    ["A millennium is how many years?", "1000", "100", "10000", "10"],
    ["What's the boiling point of water in Fahrenheit?", "212°F", "100°F", "180°F", "100°C"],
    ["What's the freezing point of water in Fahrenheit?", "32°F", "0°F", "100°F", "10°F"],
    ["How many sides does a stop sign have?", "8", "6", "4", "10"],
    ["What color is at the top of a traffic light?", "Red", "Yellow", "Green", "Blue"],
    ["What color is at the bottom of a traffic light?", "Green", "Red", "Yellow", "Blue"],
    ["What's the tallest building in the world (2026)?", "Burj Khalifa", "Empire State", "Eiffel Tower", "One World Trade"],
  ],
};

// ─── Quick fun mixed (5-8) ──────────────────────────────────────────────────
const generalKids: Pack = {
  subject: "general", ageMin: 5, ageMax: 8, difficulty: 1,
  rows: [
    ["What color is the sky on a sunny day?", "Blue", "Green", "Red", "Orange"],
    ["What color is grass?", "Green", "Blue", "Pink", "Purple"],
    ["What color are bananas?", "Yellow", "Blue", "Pink", "Green"],
    ["What color is the sun (often shown as)?", "Yellow", "Blue", "Red", "Green"],
    ["What color is snow?", "White", "Black", "Pink", "Blue"],
    ["Which animal says 'meow'?", "Cat", "Dog", "Cow", "Horse"],
    ["Which fruit is red and round?", "Apple", "Banana", "Grape", "Lemon"],
    ["Which day comes after Monday?", "Tuesday", "Sunday", "Wednesday", "Friday"],
    ["Which day comes before Monday?", "Sunday", "Tuesday", "Friday", "Saturday"],
    ["What do you wear on your feet?", "Shoes", "Hat", "Gloves", "Coat"],
    ["What do you wear on your head?", "Hat", "Shoes", "Gloves", "Boots"],
    ["What do you brush every day?", "Teeth", "Toes", "Nose", "Knees"],
    ["What do you sleep in?", "Bed", "Bathtub", "Car", "Closet"],
    ["What do you read?", "A book", "A spoon", "A shoe", "A door"],
    ["What do you eat with?", "Fork", "Pencil", "Hammer", "Crayon"],
    ["What goes in a sandwich?", "Bread", "Sand", "Stones", "Pencils"],
    ["A baby flower is called a…?", "Bud", "Stone", "Cloud", "Spark"],
    ["Which is a baby animal? Calf, fork, train, spoon", "Calf", "Fork", "Train", "Spoon"],
    ["Which is fruit? Apple, sock, lamp, brick", "Apple", "Sock", "Lamp", "Brick"],
    ["Which is a vegetable? Carrot, sock, lamp, brick", "Carrot", "Sock", "Lamp", "Brick"],
  ],
};

// ─── More science: space deeper (10-14) ─────────────────────────────────────
const space: Pack = {
  subject: "science", ageMin: 10, ageMax: 14, difficulty: 3,
  rows: [
    ["Which is the largest moon in the solar system?", "Ganymede (Jupiter)", "The Moon (Earth)", "Titan (Saturn)", "Europa"],
    ["What galaxy do we live in?", "Milky Way", "Andromeda", "Whirlpool", "Sombrero"],
    ["What do astronomers call clouds of gas and dust where stars form?", "Nebulae", "Asteroids", "Comets", "Black holes"],
    ["A 'shooting star' is actually a…?", "Meteor", "Star", "Planet", "Moon"],
    ["Which is bigger: the sun or Earth?", "The sun", "Earth", "Same size", "Cannot tell"],
    ["What's the boundary around a black hole called?", "Event horizon", "Edge", "Halo", "Crust"],
    ["What spacecraft first photographed the dark side of the moon?", "Luna 3", "Apollo 11", "Voyager 1", "Hubble"],
    ["What was the first artificial satellite?", "Sputnik 1", "Hubble", "Apollo 11", "Voyager"],
    ["Which planet has the most moons (as of recent counts)?", "Saturn", "Jupiter", "Earth", "Mars"],
    ["Why do we have seasons?", "Earth's tilt", "Distance from sun", "Moon", "Wind"],
  ],
};

// ─── Biology body deeper (10-14) ────────────────────────────────────────────
const body: Pack = {
  subject: "science", ageMin: 10, ageMax: 14, difficulty: 3,
  rows: [
    ["What carries oxygen in your blood?", "Red blood cells", "White blood cells", "Plasma", "Platelets"],
    ["Which fights infection?", "White blood cells", "Red blood cells", "Plasma", "Platelets"],
    ["Where is food broken down?", "Stomach", "Heart", "Lung", "Brain"],
    ["What's the largest organ inside the body?", "Liver", "Heart", "Lungs", "Kidney"],
    ["How many chambers in the heart?", "4", "2", "3", "5"],
    ["What's the brain's outer layer called?", "Cortex", "Stem", "Spine", "Cap"],
    ["The smallest bone in the body is in the…?", "Ear", "Foot", "Hand", "Nose"],
    ["What gives skin its color?", "Melanin", "Hemoglobin", "Keratin", "Insulin"],
    ["What hormone controls blood sugar?", "Insulin", "Adrenaline", "Estrogen", "Cortisol"],
    ["What system includes nerves and the brain?", "Nervous system", "Skeletal", "Muscular", "Digestive"],
  ],
};

// ─── Even more vocabulary (10-13) ───────────────────────────────────────────
const vocab2: Pack = {
  subject: "words", ageMin: 10, ageMax: 13, difficulty: 3,
  rows: [
    ["What does 'ample' mean?", "Plenty", "Tiny", "Quick", "Bright"],
    ["What does 'brisk' mean?", "Quick", "Slow", "Heavy", "Bright"],
    ["What does 'frigid' mean?", "Very cold", "Very hot", "Wet", "Soft"],
    ["What does 'illuminate' mean?", "Light up", "Hide", "Drop", "Shake"],
    ["What does 'nocturnal' mean?", "Active at night", "Active in day", "Underwater", "Loud"],
    ["What does 'gregarious' mean?", "Social", "Shy", "Hungry", "Tall"],
    ["What does 'meticulous' mean?", "Very careful", "Lazy", "Loud", "Sour"],
    ["What does 'aroma' mean?", "Smell", "Sound", "Sight", "Taste"],
    ["What does 'cease' mean?", "Stop", "Start", "Run", "Buy"],
    ["What does 'reluctant' mean?", "Unwilling", "Eager", "Tired", "Loud"],
    ["What does 'vivid' mean?", "Bright and clear", "Dim and faint", "Tasty", "Heavy"],
    ["What does 'humble' mean?", "Modest", "Bossy", "Tall", "Loud"],
    ["What does 'transparent' mean?", "See-through", "Solid", "Heavy", "Smelly"],
    ["What does 'commence' mean?", "Begin", "End", "Stop", "Hide"],
    ["What does 'frequent' mean?", "Often", "Rare", "Once", "Never"],
  ],
};

// ─── Combine everything ─────────────────────────────────────────────────────
const ALL_PACKS: Pack[] = [
  mathAdd, mathSub, mathMul, mathDiv, mathWord,
  animals1, animals2,
  geography1, geography2,
  scienceA, scienceB, space, body,
  historyA,
  wordsA, wordsB, vocab2,
  reading,
  riddles,
  logic,
  artMusic, musicPack,
  sports,
  generalA, generalKids,
];

export function getSeedQuestions(): SeedQ[] {
  const out: SeedQ[] = [];
  for (const p of ALL_PACKS) out.push(...expand(p));
  return out;
}
