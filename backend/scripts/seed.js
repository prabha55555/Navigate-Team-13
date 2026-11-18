/**
 * Demo data: `npm run seed`.
 *
 * Wipes and recreates ONLY the demo workspace (slug "northwind") and the demo
 * accounts' emails; every other workspace is left untouched. Deterministic
 * (seeded random numbers), so analytics look the same on every run.
 *
 * Connects to MONGO_URI (falls back to mongodb://127.0.0.1:27017/navigate).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectDB } = require('../server');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Invite = require('../models/Invite');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const QuestionBankItem = require('../models/QuestionBankItem');
const { gradeFields, recomputeTotals } = require('../services/attemptService');

const PASSWORD = 'Navigate123';
const SLUG = 'northwind';
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOW = new Date();
const daysFromNow = (d) => new Date(NOW.getTime() + d * DAY);

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);
const between = (lo, hi) => lo + rand() * (hi - lo);
const pick = (list) => list[Math.floor(rand() * list.length)];

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const OWNER = { name: 'Margaret Chen', email: 'owner@northwind.edu' };
const INSTRUCTORS = [
  { key: 'priya', name: 'Priya Sharma', email: 'priya.sharma@northwind.edu' },
  { key: 'daniel', name: 'Daniel Okafor', email: 'daniel.okafor@northwind.edu' }
];
// [name, ability 0-1]: a spread from struggling to excellent so analytics look real.
const STUDENTS = [
  ['Aarav Patel', 0.92], ['Sofia Martinez', 0.85], ['Liam Murphy', 0.62], ['Chloe Nguyen', 0.88],
  ['Kwame Mensah', 0.74], ['Fatima Alsayed', 0.81], ['Lucas Silva', 0.58], ['Hana Tanaka', 0.95],
  ['Noah Johnson', 0.30], ['Amara Okeke', 0.77], ['Mateo Rossi', 0.66], ['Zara Khan', 0.83],
  ['Ethan Kim', 0.70], ['Isabella Garcia', 0.79], ['Omar Haddad', 0.55], ['Ananya Iyer', 0.90],
  ['Jonas Becker', 0.34], ['Grace Mwangi', 0.72], ['Diego Hernandez', 0.61], ['Yuki Sato', 0.86],
  ['Olivia Brown', 0.68], ['Arjun Reddy', 0.76], ['Leila Rahimi', 0.80], ['Samuel Adeyemi', 0.64],
  ['Emma Larsen', 0.31]
].map(([name, ability]) => ({
  name,
  ability,
  email: `${name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').join('.')}@northwind.edu`
}));

// ---------------------------------------------------------------------------
// Question helpers
// ---------------------------------------------------------------------------
const mc = (topic, difficulty, text, options, correctAnswer, explanation, extra = {}) =>
  ({ type: 'multiple-choice', topic, difficulty, text, options, correctAnswer, explanation, points: 1, bloomLevel: 'Remember', ...extra });
const ms = (topic, difficulty, text, options, correctAnswer, explanation, extra = {}) =>
  ({ type: 'multiple-select', topic, difficulty, text, options, correctAnswer, explanation, points: 2, bloomLevel: 'Understand', ...extra });
const tf = (topic, difficulty, text, correctAnswer, explanation, extra = {}) =>
  ({ type: 'true-false', topic, difficulty, text, correctAnswer, explanation, points: 1, bloomLevel: 'Understand', ...extra });
// `wrong` are plausible incorrect short answers students give.
const sa = (topic, difficulty, text, correctAnswer, explanation, wrong, extra = {}) =>
  ({ type: 'short-answer', topic, difficulty, text, correctAnswer, explanation, points: 2, bloomLevel: 'Apply', $wrong: wrong, ...extra });
// `good` / `brief` are sample student answers of different quality.
const essay = (topic, difficulty, text, modelAnswer, good, brief, extra = {}) =>
  ({ type: 'essay', topic, difficulty, text, correctAnswer: modelAnswer, explanation: modelAnswer, points: 4, bloomLevel: 'Evaluate', $good: good, $brief: brief, ...extra });

// ---------------------------------------------------------------------------
// Courses and assessments
// ---------------------------------------------------------------------------
const COURSES = [
  {
    key: 'dsa',
    title: 'Data Structures & Algorithms in Java',
    code: 'CS201',
    term: 'Fall 2026',
    color: '#4f46e5',
    instructors: ['priya'],
    description: 'Core data structures (arrays, lists, stacks, queues, trees, hash tables, graphs) and the analysis of the algorithms that use them, implemented in Java.',
    topics: ['Complexity Analysis', 'Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Trees', 'Sorting', 'Hashing', 'Graphs'],
    outcomes: [
      { code: 'LO1', description: 'Analyse the time and space complexity of algorithms using Big-O notation', bloomLevel: 'Analyze' },
      { code: 'LO2', description: 'Choose an appropriate linear or hierarchical data structure for a problem', bloomLevel: 'Evaluate' },
      { code: 'LO3', description: 'Implement and compare classic sorting and searching algorithms', bloomLevel: 'Apply' },
      { code: 'LO4', description: 'Apply hashing and graph algorithms to practical problems', bloomLevel: 'Apply' }
    ],
    students: STUDENTS.slice(0, 18),
    assessments: [
      {
        key: 'dsa-q1',
        title: 'Quiz 1: Complexity, Arrays & Linked Lists',
        description: 'Covers weeks 1-3: Big-O analysis, arrays and linked lists.',
        status: 'closed', due: -40, timeLimit: 30, resultsPolicy: 'immediate', showCorrectAnswers: true,
        outcomes: ['LO1', 'LO2'],
        questions: [
          mc('Complexity Analysis', 'Easy', 'What is the time complexity of reading the element at index i of a Java array?',
            ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 'O(1)', 'Arrays are contiguous, so the address of element i is computed directly from the base address.'),
          mc('Complexity Analysis', 'Medium', 'What is the time complexity of this loop?\n\nfor (int i = 1; i < n; i *= 2) { sum += i; }',
            ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 'O(log n)', 'i doubles each iteration, so the loop runs about log₂ n times.'),
          tf('Linked Lists', 'Easy', 'Inserting a new node at the head of a singly linked list takes O(1) time.', 'True',
            'Only the new node\'s next pointer and the head reference change.'),
          tf('Arrays & Strings', 'Medium', 'ArrayList.add(x) at the end of the list is O(n) in the worst case but O(1) amortized.', 'True',
            'Occasionally the backing array is copied into a larger one (O(n)), but averaged over many adds the cost is constant.'),
          ms('Linked Lists', 'Medium', 'Which operations take O(1) time on a doubly linked list that keeps head and tail references?',
            ['Insert at head', 'Remove from tail', 'Access the k-th element', 'Insert at tail'], ['Insert at head', 'Remove from tail', 'Insert at tail'],
            'Accessing the k-th element requires walking the list, which is O(k).'),
          sa('Complexity Analysis', 'Medium', 'What is the Big-O time complexity of binary search on a sorted array of n elements?',
            ['O(log n)', 'O(logn)', 'log n', 'logarithmic'], 'Each comparison halves the remaining search range.', ['O(n)', 'O(n log n)', 'n/2']),
          mc('Arrays & Strings', 'Hard', 'Which technique finds two numbers that add up to a target in a sorted array in O(n) time?',
            ['Two pointers', 'Nested loops', 'Binary search for every element', 'Recursion with memoization'], 'Two pointers',
            'Move a left and a right pointer towards each other depending on whether the sum is too small or too large.'),
          essay('Linked Lists', 'Medium', 'Compare arrays and linked lists for a list that receives frequent insertions in the middle. Discuss time complexity and memory use.',
            'Linked lists insert in O(1) once the position is found but finding it is O(n); arrays need O(n) shifting. Linked lists use extra memory for pointers and have poor cache locality; arrays are compact and cache friendly.',
            'A linked list can insert in the middle in O(1) after we reach the node, because only pointers change, while an array has to shift every later element which is O(n). But reaching the middle of a linked list is O(n) and each node stores extra pointers, so it uses more memory and is less cache friendly.',
            'Linked list is faster to insert.')
        ]
      },
      {
        key: 'dsa-mid',
        title: 'Midterm: Stacks, Queues, Trees & Sorting',
        description: 'Proctored midterm. Full screen is required; leaving it is recorded.',
        instructions: 'You have 45 minutes. Stay in full screen. Copy/paste is disabled.',
        status: 'published', due: -14, timeLimit: 45, resultsPolicy: 'after-due', showCorrectAnswers: true, passingScore: 55,
        proctoring: { enabled: true, fullscreen: true, webcam: false, blockShortcuts: true, maxViolations: 5 },
        outcomes: ['LO2', 'LO3'],
        questions: [
          mc('Stacks & Queues', 'Easy', 'Which data structure is the natural choice for evaluating a postfix expression such as 3 4 + 2 * ?',
            ['Stack', 'Queue', 'Heap', 'Hash table'], 'Stack', 'Operands are pushed; an operator pops two operands and pushes the result.'),
          mc('Stacks & Queues', 'Medium', 'A queue uses a circular array of capacity 8. front = 6 and it holds 4 elements. At which index is the next element enqueued?',
            ['2', '10', '1', '3'], '2', 'The rear slot is (front + size) mod capacity = (6 + 4) mod 8 = 2.'),
          tf('Trees', 'Easy', 'An in-order traversal of a binary search tree visits the keys in ascending order.', 'True',
            'Left subtree keys < node < right subtree keys, and in-order visits left, node, right.'),
          mc('Trees', 'Medium', 'What is the height of a perfectly balanced binary tree with 15 nodes (a single node has height 0)?',
            ['3', '4', '7', '15'], '3', 'A perfect tree of height h has 2^(h+1) − 1 nodes; 2^4 − 1 = 15.'),
          ms('Sorting', 'Medium', 'Which sorting algorithms are stable in their standard implementation?',
            ['Merge sort', 'Insertion sort', 'Quick sort', 'Heap sort'], ['Merge sort', 'Insertion sort'],
            'Quick sort and heap sort can reorder equal keys.'),
          mc('Sorting', 'Hard', 'Quick sort degrades to O(n²) when…',
            ['The pivot is always the smallest or largest element', 'The array contains only duplicate keys of two values', 'The array length is a power of two', 'Recursion depth is limited to log n'],
            'The pivot is always the smallest or largest element', 'Every partition then removes only one element, giving n levels of O(n) work.'),
          tf('Sorting', 'Medium', 'Merge sort on an array needs only O(1) extra memory.', 'False', 'The standard array merge step needs an O(n) auxiliary buffer.'),
          sa('Trees', 'Hard', 'How many null child references does a binary tree with n nodes have? Answer as an expression in n.',
            ['n + 1', 'n+1'], 'There are 2n child slots and n − 1 edges, so 2n − (n − 1) = n + 1 slots are null.', ['2n', 'n', 'n - 1']),
          mc('Trees', 'Hard', 'After inserting 50, 30, 70, 20, 40, 60 into an empty BST, which key is the in-order successor of 40?',
            ['50', '60', '30', '70'], '50', '40 has no right child, so its successor is the nearest ancestor for which 40 is in the left subtree: 50.'),
          essay('Sorting', 'Hard', 'Explain why any comparison-based sorting algorithm needs Ω(n log n) comparisons in the worst case.',
            'A comparison sort corresponds to a binary decision tree whose leaves are the n! possible orderings. A binary tree with n! leaves has height at least log₂(n!) = Ω(n log n), so some input needs that many comparisons.',
            'Every comparison sort can be drawn as a decision tree where each leaf is one of the n! permutations of the input. A binary tree with n! leaves must have height at least log(n!), and log(n!) is Θ(n log n) by Stirling, so the worst case needs Ω(n log n) comparisons.',
            'Because sorting compares elements.')
        ]
      },
      {
        key: 'dsa-q3',
        title: 'Quiz 3: Hashing & Graphs',
        description: 'Hash tables, collision handling, BFS/DFS and shortest paths.',
        status: 'published', due: 5, timeLimit: 20, maxAttempts: 2, resultsPolicy: 'immediate', showCorrectAnswers: false,
        outcomes: ['LO4'],
        questions: [
          mc('Hashing', 'Easy', 'What is the average-case time complexity of a lookup in a well-sized hash table?',
            ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 'O(1)', 'With a good hash function and bounded load factor each bucket holds O(1) keys on average.'),
          mc('Hashing', 'Medium', 'Which collision-resolution strategy keeps a list of entries in each bucket?',
            ['Separate chaining', 'Linear probing', 'Quadratic probing', 'Double hashing'], 'Separate chaining', 'The probing strategies are forms of open addressing.'),
          tf('Hashing', 'Medium', 'If two Java objects are equal according to equals(), they must return the same hashCode().', 'True',
            'This is the hashCode contract; HashMap relies on it.'),
          mc('Graphs', 'Medium', 'Which traversal finds a path with the fewest edges in an unweighted graph?',
            ['Breadth-first search', 'Depth-first search', 'In-order traversal', 'Topological sort'], 'Breadth-first search', 'BFS explores vertices in order of distance from the source.'),
          ms('Graphs', 'Hard', 'Which algorithms compute single-source shortest paths when all edge weights are non-negative?',
            ["Dijkstra's algorithm", 'Bellman-Ford', "Prim's algorithm", "Kruskal's algorithm"], ["Dijkstra's algorithm", 'Bellman-Ford'],
            'Prim and Kruskal build minimum spanning trees, not shortest paths.'),
          sa('Graphs', 'Medium', "Which data structure does Dijkstra's algorithm typically use to select the next closest vertex?",
            ['priority queue', 'min-heap', 'min heap', 'binary heap', 'heap'], 'A min-priority queue returns the unvisited vertex with the smallest tentative distance.', ['queue', 'stack', 'array']),
          essay('Hashing', 'Medium', "Describe what happens to performance as a hash table's load factor grows, and how Java's HashMap responds.",
            'As the load factor grows, buckets get longer and lookups degrade towards O(n). HashMap resizes (doubles capacity and rehashes) when size exceeds capacity × 0.75, and converts long buckets to balanced trees.',
            'When the load factor gets higher there are more collisions, so chains get longer and get/put slow down. Java HashMap doubles its table and rehashes all entries when it passes 0.75 load factor, and long buckets become red-black trees.',
            'It gets slower.', { points: 3 })
        ]
      },
      {
        key: 'dsa-final',
        title: 'Final Exam',
        description: 'Draft — being written.',
        status: 'draft', due: 30, timeLimit: 90,
        questions: [
          mc('Graphs', 'Medium', 'What is the time complexity of BFS on a graph with V vertices and E edges stored as adjacency lists?',
            ['O(V + E)', 'O(V²)', 'O(E log V)', 'O(V · E)'], 'O(V + E)', 'Each vertex is enqueued once and each edge examined once.'),
          tf('Trees', 'Medium', 'An AVL tree guarantees O(log n) height.', 'True', 'Rotations keep the height difference of subtrees at most 1.')
        ]
      }
    ]
  },
  {
    key: 'web',
    title: 'Web Development Fundamentals',
    code: 'WEB110',
    term: 'Fall 2026',
    color: '#0891b2',
    instructors: ['daniel'],
    description: 'Semantic HTML, modern CSS layout, JavaScript and the DOM, HTTP and accessible design.',
    topics: ['HTML Semantics', 'CSS Layout', 'JavaScript Basics', 'DOM & Events', 'HTTP & APIs', 'Accessibility'],
    outcomes: [
      { code: 'LO1', description: 'Structure documents with semantic, accessible HTML', bloomLevel: 'Apply' },
      { code: 'LO2', description: 'Build responsive layouts with Flexbox and Grid', bloomLevel: 'Create' },
      { code: 'LO3', description: 'Write JavaScript that manipulates the DOM and talks to HTTP APIs', bloomLevel: 'Apply' }
    ],
    students: [...STUDENTS.slice(8, 20), ...STUDENTS.slice(22, 25)],
    assessments: [
      {
        key: 'web-q1',
        title: 'Quiz 1: HTML & CSS',
        description: 'Semantic markup, the box model and layout.',
        status: 'closed', due: -28, timeLimit: 25, resultsPolicy: 'immediate', showCorrectAnswers: true,
        outcomes: ['LO1', 'LO2'],
        questions: [
          mc('HTML Semantics', 'Easy', 'Which element should wrap the main navigation links of a page?',
            ['<nav>', '<div class="nav">', '<section>', '<aside>'], '<nav>', '<nav> tells browsers and assistive technology that this is a navigation landmark.'),
          tf('Accessibility', 'Easy', 'The alt attribute of an <img> should describe the image\'s content or purpose.', 'True',
            'Screen readers read alt text; decorative images should use alt="".'),
          mc('CSS Layout', 'Medium', 'Which declaration makes a flex container lay out its children vertically?',
            ['flex-direction: column', 'display: column', 'flex-wrap: column', 'align-items: column'], 'flex-direction: column', 'flex-direction sets the main axis.'),
          ms('CSS Layout', 'Medium', 'Which of these are part of the CSS box model?',
            ['margin', 'border', 'padding', 'z-index'], ['margin', 'border', 'padding'], 'The box model is content, padding, border and margin; z-index controls stacking.'),
          mc('CSS Layout', 'Hard', 'Given .a { color: red } and #b { color: blue }, what color is the text of <p id="b" class="a">?',
            ['Blue', 'Red', 'Black (default)', 'It depends on source order'], 'Blue', 'An id selector is more specific than a class selector, regardless of order.'),
          sa('HTML Semantics', 'Easy', 'Which HTML attribute makes a form field mandatory before the form can be submitted?',
            'required', 'The boolean required attribute enables built-in validation.', ['mandatory', 'validate', 'needed']),
          tf('Accessibility', 'Medium', 'Showing a field in red is enough to tell all users that it has an error.', 'False',
            'Color-blind and screen reader users need a text message as well (WCAG 1.4.1).'),
          essay('CSS Layout', 'Medium', 'When would you choose CSS Grid over Flexbox? Give an example layout for each.',
            'Grid is two-dimensional (rows and columns at once), e.g. a page layout or photo gallery; Flexbox is one-dimensional, e.g. a navbar or a row of buttons that should share space.',
            'I would use Grid for two dimensional layouts like a whole page with header, sidebar, main and footer or an image gallery. Flexbox is better for one direction, for example a navigation bar where items are spaced along a row.',
            'Grid is for grids.')
        ]
      },
      {
        key: 'web-q2',
        title: 'Quiz 2: JavaScript & the DOM',
        description: 'Types, arrays, events and HTTP.',
        status: 'published', due: 9, timeLimit: 25, resultsPolicy: 'immediate', showCorrectAnswers: true,
        outcomes: ['LO3'],
        questions: [
          mc('JavaScript Basics', 'Easy', 'What does typeof null return in JavaScript?',
            ['"object"', '"null"', '"undefined"', '"number"'], '"object"', 'A long-standing quirk of the language.'),
          mc('JavaScript Basics', 'Medium', 'What is logged by console.log([1, 2, 3].map(x => x * 2).filter(x => x > 2))?',
            ['[4, 6]', '[2, 4, 6]', '[6]', '[1, 2, 3]'], '[4, 6]', 'map gives [2, 4, 6]; filter keeps values greater than 2.'),
          tf('JavaScript Basics', 'Medium', 'A variable declared with const cannot be reassigned, but the object it refers to can still be mutated.', 'True',
            'const makes the binding constant, not the value.'),
          ms('DOM & Events', 'Medium', 'Which methods return a single element (or null)?',
            ['document.querySelector', 'document.getElementById', 'document.querySelectorAll', 'document.getElementsByClassName'],
            ['document.querySelector', 'document.getElementById'], 'The other two return collections.'),
          mc('DOM & Events', 'Hard', "Which call stops an event from reaching ancestor elements' listeners?",
            ['event.stopPropagation()', 'event.preventDefault()', 'Returning false from the listener', 'event.cancel()'], 'event.stopPropagation()',
            'preventDefault cancels the browser default action but the event still bubbles.'),
          sa('HTTP & APIs', 'Easy', "Which HTTP status code means 'Not Found'?", '404', '4xx codes are client errors; 404 means the resource does not exist.', ['400', '500', '403']),
          mc('HTTP & APIs', 'Medium', 'Which HTTP method is idempotent and typically replaces a resource?',
            ['PUT', 'POST', 'PATCH', 'CONNECT'], 'PUT', 'Sending the same PUT twice leaves the resource in the same state.'),
          essay('HTTP & APIs', 'Medium', 'Explain what CORS is and why a browser might block a fetch() call to another domain.',
            'CORS lets a server declare which other origins may read its responses via Access-Control-Allow-* headers. Browsers enforce the same-origin policy and block reading cross-origin responses that lack those headers.',
            'CORS (cross-origin resource sharing) is how a server tells the browser which other origins may read its responses, using headers like Access-Control-Allow-Origin. Without them the same-origin policy makes the browser block the response.',
            'Security reasons.', { points: 3 })
        ]
      },
      {
        key: 'web-draft',
        title: 'Project Checkpoint: Accessible Landing Page',
        description: 'Draft — reflection questions for the mid-term project.',
        status: 'draft', due: 21,
        questions: [
          essay('Accessibility', 'Medium', 'Describe three accessibility checks you ran on your landing page and what you fixed.',
            'Examples: keyboard navigation, colour contrast, alt text, landmarks, form labels.', '', '')
        ]
      }
    ]
  },
  {
    key: 'db',
    title: 'Database Systems',
    code: 'DB220',
    term: 'Fall 2026',
    color: '#059669',
    instructors: ['priya', 'daniel'],
    description: 'The relational model, SQL, schema design and normalization, indexing and transactions.',
    topics: ['Relational Model', 'SQL Queries', 'Joins', 'Normalization', 'Indexing', 'Transactions'],
    outcomes: [
      { code: 'LO1', description: 'Write SQL queries with joins, grouping and subqueries', bloomLevel: 'Apply' },
      { code: 'LO2', description: 'Design normalized relational schemas', bloomLevel: 'Create' },
      { code: 'LO3', description: 'Explain indexing and transaction isolation trade-offs', bloomLevel: 'Analyze' }
    ],
    students: [...STUDENTS.slice(0, 4), ...STUDENTS.slice(12, 25)].filter((s, i, all) => all.indexOf(s) === i).slice(0, 16),
    assessments: [
      {
        key: 'db-q1',
        title: 'Quiz 1: SQL Fundamentals',
        description: 'SELECT, filtering, aggregation and joins.',
        status: 'closed', due: -35, timeLimit: 30, resultsPolicy: 'immediate', showCorrectAnswers: true,
        outcomes: ['LO1'],
        questions: [
          mc('SQL Queries', 'Easy', 'Which clause filters groups after aggregation?', ['HAVING', 'WHERE', 'ORDER BY', 'GROUP BY'], 'HAVING',
            'WHERE filters rows before grouping; HAVING filters the groups.'),
          mc('Joins', 'Medium', 'Which join returns every row of the left table plus matching rows of the right table?',
            ['LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'CROSS JOIN'], 'LEFT JOIN', 'Unmatched left rows get NULLs for the right-hand columns.'),
          tf('Relational Model', 'Easy', 'A primary key column may contain NULL values.', 'False', 'Primary keys are implicitly NOT NULL and unique.'),
          ms('SQL Queries', 'Medium', 'Which of these are aggregate functions in standard SQL?', ['COUNT', 'SUM', 'AVG', 'UPPER'], ['COUNT', 'SUM', 'AVG'],
            'UPPER is a scalar string function.'),
          sa('SQL Queries', 'Easy', 'Which SQL keyword removes duplicate rows from a query result?', 'DISTINCT', 'SELECT DISTINCT returns unique rows.', ['UNIQUE', 'GROUP', 'FILTER']),
          mc('Joins', 'Hard', 'Table A has 4 rows and table B has 5 rows. How many rows does A CROSS JOIN B return?', ['20', '9', '5', '4'], '20',
            'A cross join pairs every row of A with every row of B.'),
          tf('Relational Model', 'Medium', 'A foreign key must reference a primary key or a unique column of the referenced table.', 'True',
            'The referenced columns must identify exactly one row.'),
          essay('Joins', 'Medium', 'Explain the difference between INNER JOIN and LEFT JOIN using customers and orders as an example.',
            'INNER JOIN returns only customers that have orders; LEFT JOIN returns all customers, with NULL order columns for customers without orders.',
            'An INNER JOIN between customers and orders only returns customers that placed at least one order. A LEFT JOIN from customers returns every customer, and customers with no orders appear once with NULL in the order columns.',
            'Left join keeps more rows.')
        ]
      },
      {
        key: 'db-q2',
        title: 'Quiz 2: Normalization & Indexing',
        description: 'Functional dependencies, normal forms and B-tree indexes.',
        status: 'published', due: -10, timeLimit: 30, resultsPolicy: 'manual', resultsReleased: true, showCorrectAnswers: true,
        outcomes: ['LO2', 'LO3'],
        questions: [
          mc('Normalization', 'Medium', 'A table is in 2NF when it is in 1NF and…',
            ['every non-key attribute depends on the whole primary key', 'it has no repeating groups', 'it has no transitive dependencies', 'every determinant is a candidate key'],
            'every non-key attribute depends on the whole primary key', '2NF removes partial dependencies on part of a composite key.'),
          mc('Normalization', 'Hard', 'Which normal form removes transitive dependencies of non-key attributes on the key?', ['3NF', '1NF', '2NF', '4NF'], '3NF',
            'In 3NF no non-key attribute depends on another non-key attribute.'),
          tf('Indexing', 'Medium', 'Adding an index always makes INSERT statements faster.', 'False', 'Every index must also be updated on insert, so writes get slower.'),
          ms('Indexing', 'Medium', 'Which conditions can typically use a B-tree index on orders(created_at)?',
            ["WHERE created_at > '2026-01-01'", 'ORDER BY created_at', 'WHERE YEAR(created_at) = 2026', "WHERE created_at BETWEEN '2026-01-01' AND '2026-03-31'"],
            ["WHERE created_at > '2026-01-01'", 'ORDER BY created_at', "WHERE created_at BETWEEN '2026-01-01' AND '2026-03-31'"],
            'Wrapping the column in a function (YEAR) prevents a plain index from being used.'),
          sa('Normalization', 'Medium', 'Which anomaly occurs when deleting a row also removes unrelated facts you wanted to keep?',
            ['deletion anomaly', 'deletion', 'delete anomaly'], 'Storing two facts in one row means deleting one loses the other.', ['update anomaly', 'insert', 'lost data']),
          essay('Normalization', 'Hard', 'Normalize Enrollment(student_id, student_name, course_id, course_title, grade) to 3NF and explain each step.',
            'Key is (student_id, course_id). student_name depends only on student_id and course_title only on course_id (partial dependencies), so split into Student(student_id, student_name), Course(course_id, course_title) and Enrollment(student_id, course_id, grade).',
            'The key is (student_id, course_id). student_name depends only on student_id and course_title only on course_id, which are partial dependencies, so it is not 2NF. I split it into Student(student_id, student_name), Course(course_id, course_title) and Enrollment(student_id, course_id, grade), which is also 3NF.',
            'Split the table into two.')
        ]
      },
      {
        key: 'db-q3',
        title: 'Quiz 3: Transactions & Concurrency',
        description: 'ACID, isolation levels and locking. Results are released after review.',
        status: 'published', due: 12, timeLimit: 30, resultsPolicy: 'manual', showCorrectAnswers: true,
        outcomes: ['LO3'],
        questions: [
          mc('Transactions', 'Easy', 'Which ACID property guarantees that committed data survives a crash?', ['Durability', 'Atomicity', 'Consistency', 'Isolation'], 'Durability',
            'Committed changes are written to stable storage (e.g. the write-ahead log).'),
          mc('Transactions', 'Medium', 'Which anomaly is still possible under the READ COMMITTED isolation level?',
            ['Non-repeatable reads', 'Dirty reads', 'Lost commits', 'Torn pages'], 'Non-repeatable reads', 'Another transaction may commit between two reads of the same row.'),
          tf('Transactions', 'Medium', 'Strict two-phase locking produces conflict-serializable schedules.', 'True', 'All locks are acquired before any is released.'),
          ms('Transactions', 'Hard', 'Which statements about deadlocks are true?',
            ['They correspond to a cycle in the wait-for graph', 'The DBMS may abort a victim transaction to resolve one', 'They need more than ten concurrent transactions', 'Lock timeouts can be used to break them'],
            ['They correspond to a cycle in the wait-for graph', 'The DBMS may abort a victim transaction to resolve one', 'Lock timeouts can be used to break them'],
            'Two transactions are enough for a deadlock.'),
          sa('Transactions', 'Easy', 'Which SQL command undoes all changes made by the current transaction?', 'ROLLBACK', 'COMMIT makes changes permanent; ROLLBACK discards them.', ['UNDO', 'REVERT', 'ABORT']),
          essay('Transactions', 'Medium', 'Describe a lost update and how locking or optimistic concurrency control prevents it.',
            'Two transactions read the same value and both write back, so one update overwrites the other. Locking (SELECT … FOR UPDATE) serializes them; optimistic control checks a version number and retries on conflict.',
            'A lost update is when two transactions read the same balance, both change it and write it back, so the first write is overwritten. With locking the second transaction waits for the first; with optimistic control a version column detects the conflict and one transaction retries.',
            'Use locks.', { points: 3 })
        ]
      },
      {
        key: 'db-draft',
        title: 'Final Project Design Review',
        description: 'Draft.',
        status: 'draft', due: 28,
        questions: [
          essay('Normalization', 'Medium', 'Submit the ER diagram of your project and justify two design decisions.', '', '', '')
        ]
      }
    ]
  }
];

const BANK = [
  { course: 'dsa', item: mc('Stacks & Queues', 'Easy', 'Which operation removes the most recently added element from a stack?', ['pop', 'dequeue', 'peek', 'poll'], 'pop', 'Stacks are LIFO.'), tags: ['stacks', 'basics', 'practice'] },
  { course: 'dsa', item: tf('Graphs', 'Medium', 'Depth-first search can be implemented with an explicit stack instead of recursion.', 'True', 'Recursion uses the call stack implicitly.'), tags: ['graphs'] },
  { course: 'dsa', item: ms('Trees', 'Hard', 'Which trees are self-balancing?', ['AVL tree', 'Red-black tree', 'Binary search tree', 'Trie'], ['AVL tree', 'Red-black tree'], 'A plain BST can degenerate into a list.'), tags: ['trees', 'balancing'] },
  { course: 'db', item: mc('Indexing', 'Medium', 'Which index type is best for range queries?', ['B-tree', 'Hash', 'Bitmap', 'None'], 'B-tree', 'B-trees keep keys ordered.'), tags: ['indexing', 'practice'] },
  { course: 'db', item: sa('SQL Queries', 'Easy', 'Which clause sorts query results?', 'ORDER BY', 'ORDER BY col ASC|DESC.', []), tags: ['sql'] },
  { course: null, item: tf('Accessibility', 'Easy', 'Every form input should have an associated <label>.', 'True', 'Labels give inputs an accessible name.'), tags: ['accessibility', 'forms'] }
];

// ---------------------------------------------------------------------------
// Answer simulation
// ---------------------------------------------------------------------------
const DIFFICULTY_SHIFT = { Easy: 0.15, Medium: 0, Hard: -0.2 };

/** Per student and topic strength offset, so mastery heatmaps show real variation. */
function topicStrength(student, topic) {
  const h = crypto.createHash('md5').update(`${student.email}|${topic}`).digest();
  return (h[0] / 255 - 0.5) * 0.4;
}

function answerFor(q, student) {
  const p = Math.min(0.98, Math.max(0.03, student.ability + DIFFICULTY_SHIFT[q.difficulty] + topicStrength(student, q.topic)));
  const right = rand() < p;
  switch (q.type) {
    case 'multiple-choice':
      return right ? q.correctAnswer : pick(q.options.filter((o) => o !== q.correctAnswer));
    case 'multiple-select': {
      if (right) return [...q.correctAnswer];
      const partial = q.correctAnswer.slice(0, Math.max(1, q.correctAnswer.length - 1));
      const wrong = q.options.find((o) => !q.correctAnswer.includes(o));
      return rand() < 0.5 ? partial : [...partial, wrong];
    }
    case 'true-false':
      return right ? q.correctAnswer : (q.correctAnswer === 'True' ? 'False' : 'True');
    case 'short-answer':
      if (right) return Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer;
      return rand() < 0.15 ? '' : pick(q.$wrong.length ? q.$wrong : ['not sure']);
    case 'essay':
      if (p > 0.7 && rand() < 0.85) return q.$good;
      if (p > 0.4 && rand() < 0.8) return q.$brief;
      return rand() < 0.5 ? 'I am not sure about this one.' : '';
    default:
      return null;
  }
}

/** Strips seed-only helper fields ($good, $wrong, …) from a question. */
const cleanQ = (q) => Object.fromEntries(Object.entries(q).filter(([k]) => !k.startsWith('$')));

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
async function wipe() {
  const emails = [OWNER.email, ...INSTRUCTORS.map((i) => i.email), ...STUDENTS.map((s) => s.email)];
  const org = await Organization.findOne({ slug: SLUG }).select('_id').lean();
  if (org) {
    const scoped = [Course, Enrollment, Assessment, Submission, QuestionBankItem, Notification, AuditLog, Invite];
    await Promise.all(scoped.map((M) => M.deleteMany({ organization: org._id })));
    await User.deleteMany({ organization: org._id });
    await Organization.deleteOne({ _id: org._id });
  }
  await User.deleteMany({ email: { $in: emails } });
}

async function seed() {
  await wipe();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const org = await Organization.create({
    name: 'Northwind Institute of Technology',
    slug: SLUG,
    plan: 'pro',
    branding: { primaryColor: '#4f46e5', logoUrl: '' },
    usage: { period: NOW.toISOString().slice(0, 7), aiGenerations: 37 }
  });
  const user = (role, person, joinedDaysAgo) => ({
    organization: org._id,
    name: person.name,
    email: person.email,
    password: passwordHash,
    role,
    lastLoginAt: daysFromNow(-between(0, 3)),
    createdAt: daysFromNow(-joinedDaysAgo)
  });
  // insertMany skips the password-hashing save hook, so the hash above is stored as is.
  const [owner, ...rest] = await User.insertMany([
    user('owner', OWNER, 90),
    ...INSTRUCTORS.map((i) => user('instructor', i, 85)),
    ...STUDENTS.map((s) => user('student', s, Math.round(between(50, 75))))
  ]);
  org.createdBy = owner._id;
  await org.save();
  const instructorBy = Object.fromEntries(INSTRUCTORS.map((i, idx) => [i.key, rest[idx]]));
  const studentDocs = rest.slice(INSTRUCTORS.length);
  const docByEmail = new Map(studentDocs.map((d) => [d.email, d]));

  const notifications = [];
  const audits = [];
  // Campus network addresses (private range) so the audit log shows where actions came from.
  const OFFICE_IPS = { owner: '10.20.1.12', priya: '10.20.4.31', daniel: '10.20.4.57' };
  const ipOf = (actorId) => {
    if (String(actorId) === String(owner._id)) return OFFICE_IPS.owner;
    const key = Object.keys(instructorBy).find((k) => String(instructorBy[k]._id) === String(actorId));
    return OFFICE_IPS[key] || '10.20.9.4';
  };
  const log = (actor, action, targetType, targetId, at, meta) => audits.push({
    organization: org._id, actor, action, targetType, targetId: String(targetId), meta, ip: ipOf(actor), createdAt: at
  });
  const note = (u, type, title, body, link, at) => notifications.push({
    organization: org._id, user: u, type, title, body, link, createdAt: at, readAt: at < daysFromNow(-3) ? at : null
  });

  let submissionTotal = 0;
  for (const spec of COURSES) {
    // eslint-disable-next-line no-await-in-loop
    const course = await Course.create({
      organization: org._id,
      title: spec.title,
      code: spec.code,
      description: spec.description,
      term: spec.term,
      color: spec.color,
      topics: spec.topics,
      outcomes: spec.outcomes,
      instructors: spec.instructors.map((k) => instructorBy[k]._id),
      createdBy: instructorBy[spec.instructors[0]]._id,
      createdAt: daysFromNow(-60)
    });
    const lead = instructorBy[spec.instructors[0]]._id;
    log(lead, 'course.create', 'Course', course._id, daysFromNow(-60), { title: course.title });
    log(lead, 'course.student_add', 'Course', course._id, daysFromNow(-58), { added: spec.students.length });
    if (spec.instructors.length > 1) {
      log(owner._id, 'course.instructor_add', 'Course', course._id, daysFromNow(-57), { user: String(instructorBy[spec.instructors[1]]._id) });
    }

    const roster = spec.students.map((s) => ({ ...s, doc: docByEmail.get(s.email) }));
    // eslint-disable-next-line no-await-in-loop
    await Enrollment.insertMany(roster.map((s) => ({
      organization: org._id, course: course._id, student: s.doc._id, enrolledAt: daysFromNow(-between(45, 58))
    })));

    const links = [];
    for (const a of spec.assessments) {
      const dueDate = daysFromNow(a.due);
      // eslint-disable-next-line no-await-in-loop
      const assessment = await Assessment.create({
        organization: org._id,
        course: course._id,
        createdBy: instructorBy[spec.instructors[0]]._id,
        title: a.title,
        description: a.description || '',
        instructions: a.instructions || '',
        status: a.status,
        // Open since 10 days before the due date (open work: at least since 4 days ago).
        publishedAt: a.status === 'draft' ? undefined : new Date(Math.min(dueDate.getTime() - 10 * DAY, daysFromNow(-4).getTime())),
        availableFrom: a.status === 'draft' ? undefined : new Date(Math.min(dueDate.getTime() - 10 * DAY, daysFromNow(-4).getTime())),
        dueDate,
        timeLimit: a.timeLimit || 0,
        maxAttempts: a.maxAttempts || 1,
        passingScore: a.passingScore || 50,
        resultsPolicy: a.resultsPolicy || 'immediate',
        resultsReleased: !!a.resultsReleased,
        showCorrectAnswers: !!a.showCorrectAnswers,
        shuffleOptions: a.status !== 'draft',
        proctoring: a.proctoring || { enabled: false },
        source: 'manual',
        questions: a.questions.map((q, i) => ({ ...cleanQ(q), id: `q${i + 1}` })),
        createdAt: new Date(dueDate.getTime() - 14 * DAY)
      });
      (a.outcomes || []).forEach((code) => {
        const outcome = course.outcomes.find((o) => o.code === code);
        if (outcome) links.push({ outcomeId: outcome.id, assessmentId: assessment._id });
      });
      log(lead, 'assessment.create', 'Assessment', assessment._id, assessment.createdAt, { title: a.title });
      if (a.status === 'draft') continue; // eslint-disable-line no-continue
      log(lead, 'assessment.publish', 'Assessment', assessment._id, assessment.publishedAt);
      if (a.status === 'closed') log(lead, 'assessment.close', 'Assessment', assessment._id, new Date(dueDate.getTime() + 2 * 60 * MIN));
      if (a.resultsReleased) log(lead, 'assessment.release_results', 'Assessment', assessment._id, new Date(dueDate.getTime() + 2 * DAY));

      roster.forEach((s) => note(s.doc._id, 'assessment.published', `New assessment: ${a.title}`,
        `${spec.title} · due ${dueDate.toISOString().slice(0, 10)}`, `/app/take/${assessment._id}`, assessment.publishedAt));

      // Who takes it: everyone for past work (minus one no-show), about half so far for open work.
      const open = a.due > 0;
      const takers = roster.filter((s, i) => (open ? (i % 2 === 0 || s.ability > 0.85) : i !== roster.length - 2));
      const subs = [];
      takers.forEach((s, idx) => {
        const questionsWithIds = assessment.questions.map((q, i) => ({ ...a.questions[i], id: q.id }));
        const answers = {};
        questionsWithIds.forEach((q) => {
          const value = answerFor(q, s);
          if (value !== '' && value !== null) answers[q.id] = value;
        });
        const limit = (a.timeLimit || 30) * MIN;
        const startedAt = open
          ? daysFromNow(-between(0.1, 3))
          : new Date(dueDate.getTime() - between(0.2, 6) * DAY);
        const inProgress = open && idx % 5 === 4;
        const timeSpentMs = Math.round(limit * between(0.35, 0.95));
        const sub = {
          organization: org._id,
          assessment: assessment._id,
          course: course._id,
          student: s.doc._id,
          attempt: 1,
          startedAt,
          deadlineAt: a.timeLimit ? new Date(Math.min(startedAt.getTime() + limit, dueDate.getTime())) : dueDate,
          questionOrder: assessment.questions.map((q) => q.id),
          integrity: { violationCount: 0, terminated: false, events: [] }
        };
        if (inProgress) {
          sub.startedAt = new Date(NOW.getTime() - 6 * MIN);
          sub.deadlineAt = new Date(sub.startedAt.getTime() + limit);
          sub.status = 'in-progress';
          sub.answers = Object.fromEntries(Object.entries(answers).slice(0, 3));
          subs.push(sub);
          return;
        }
        Object.assign(sub, gradeFields(assessment, answers, course.topics), {
          answers,
          status: 'submitted',
          submittedAt: new Date(startedAt.getTime() + timeSpentMs),
          timeSpent: Math.round(timeSpentMs / 1000)
        });
        subs.push(sub);
      });

      // Integrity story on the proctored midterm: two students with warnings, one terminated.
      if (a.proctoring && a.proctoring.enabled) {
        const finished = subs.filter((s) => s.status === 'submitted');
        const event = (type, detail, base, offsetMin) => ({ type, detail, at: new Date(base.getTime() + offsetMin * MIN) });
        [finished[3], finished[9]].filter(Boolean).forEach((s, i) => {
          s.integrity.events = [event('fullscreen_exit', 'Left full screen', s.startedAt, 7 + i), event('tab_hidden', 'Switched to another tab', s.startedAt, 19)];
          s.integrity.violationCount = 2;
        });
        const victim = finished.find((s) => String(s.student) === String(docByEmail.get('noah.johnson@northwind.edu')._id));
        if (victim) {
          victim.integrity.events = [
            event('fullscreen_exit', 'Left full screen', victim.startedAt, 3),
            event('blocked_shortcut', 'Ctrl+C', victim.startedAt, 5),
            event('tab_hidden', 'Switched to another tab', victim.startedAt, 8),
            event('paste', 'Pasted 240 characters', victim.startedAt, 9),
            event('fullscreen_exit', 'Left full screen', victim.startedAt, 11)
          ];
          victim.integrity.violationCount = 5;
          victim.integrity.terminated = true;
          victim.status = 'terminated';
          victim.submittedAt = new Date(victim.startedAt.getTime() + 11 * MIN);
          victim.timeSpent = 11 * 60;
        }
      }

      // Written answers on closed work have been reviewed; on recent work only a few so far.
      if (!open) {
        const essayId = assessment.questions.find((q) => q.type === 'essay');
        const toReview = subs.filter((s) => s.status === 'submitted' && s.needsReview);
        toReview.slice(0, a.status === 'closed' ? toReview.length : 4).forEach((s, i) => {
          s.questionResults.forEach((r) => {
            if (r.needsReview) {
              r.needsReview = false;
              if (essayId && r.questionId === essayId.id && i === 0) r.pointsEarned = r.maxPoints;
            }
          });
          if (i === 1) s.override = { score: Math.min(s.maxScore, Math.round((s.score || 0) + 2)), comment: 'Good reasoning in the essay; partial credit restored.', by: instructorBy[spec.instructors[0]]._id, at: new Date(dueDate.getTime() + DAY) };
          recomputeTotals(s, assessment, course.topics);
        });
      }

      if (subs.length) {
        // eslint-disable-next-line no-await-in-loop
        const inserted = await Submission.insertMany(subs.map((s) => ({ ...s, createdAt: s.startedAt, updatedAt: s.submittedAt || s.startedAt })));
        inserted.filter((s) => s.override && typeof s.override.score === 'number').forEach((s) => log(lead, 'submission.grade', 'Submission', s._id, s.override.at, { score: s.score, maxScore: s.maxScore, override: true }));
        submissionTotal += subs.length;
        const last = subs.filter((s) => s.submittedAt).sort((x, y) => y.submittedAt - x.submittedAt)[0];
        if (last) {
          spec.instructors.forEach((k) => note(instructorBy[k]._id, 'submission.received', `New submission: ${a.title}`,
            `${subs.filter((s) => s.submittedAt).length === 1 ? '1 student has' : `${subs.filter((s) => s.submittedAt).length} students have`} submitted "${a.title}".`, `/app/assessments/${assessment._id}`, last.submittedAt));
        }
        if (a.resultsReleased) {
          subs.filter((s) => s.submittedAt).forEach((s) => note(s.student, 'results.released', `Results available: ${a.title}`,
            `Your results for "${a.title}" (${spec.title}) are ready.`, '/app/results', new Date(dueDate.getTime() + 2 * DAY)));
        }
      }
    }
    course.curriculumMap = { links };
    // eslint-disable-next-line no-await-in-loop
    await course.save();
  }

  // Question bank
  const courseByKey = Object.fromEntries((await Course.find({ organization: org._id }).lean())
    .map((c) => [COURSES.find((s) => s.title === c.title).key, c]));
  await QuestionBankItem.insertMany(BANK.map(({ course, item, tags }) => ({
    ...cleanQ(item),
    organization: org._id,
    course: course ? courseByKey[course]._id : null,
    createdBy: instructorBy[course === 'web' ? 'daniel' : 'priya']._id,
    tags
  })));

  // A pending instructor invite and workspace notifications for the owner.
  const invite = await Invite.create({
    organization: org._id,
    code: crypto.randomBytes(9).toString('base64url'),
    role: 'instructor',
    createdBy: owner._id,
    expiresAt: daysFromNow(7),
    maxUses: 1
  });
  note(owner._id, 'member.joined', `${STUDENTS[24].name} joined the workspace`, `${STUDENTS[24].name} (${STUDENTS[24].email}) joined as student.`, '/app/settings/members', daysFromNow(-50));
  note(owner._id, 'member.joined', `${INSTRUCTORS[1].name} joined the workspace`, `${INSTRUCTORS[1].name} (${INSTRUCTORS[1].email}) joined as instructor.`, '/app/settings/members', daysFromNow(-85));
  log(owner._id, 'workspace.create', 'Organization', org._id, daysFromNow(-90));
  log(owner._id, 'invite.create', 'Invite', invite._id, daysFromNow(-1), { role: 'instructor' });
  await Notification.insertMany(notifications);
  await AuditLog.insertMany(audits);

  return { org, submissionTotal, notificationTotal: notifications.length, invite };
}

async function main() {
  const connected = await connectDB();
  if (!connected) throw new Error('Could not connect to MongoDB (set MONGO_URI)');
  const { submissionTotal, notificationTotal, invite } = await seed();
  /* eslint-disable no-console */
  console.log(`\nSeeded "Northwind Institute of Technology" into database "${mongoose.connection.name}"`);
  console.log(`  ${STUDENTS.length} students, ${INSTRUCTORS.length} instructors, ${COURSES.length} courses, ${COURSES.reduce((n, c) => n + c.assessments.length, 0)} assessments`);
  console.log(`  ${submissionTotal} submissions, ${BANK.length} question-bank items, ${notificationTotal} notifications`);
  console.log(`  Pending instructor invite code: ${invite.code}\n`);
  console.log(`Demo logins (password for every account: ${PASSWORD})`);
  console.log(`  Owner       ${OWNER.email}`);
  INSTRUCTORS.forEach((i) => console.log(`  Instructor  ${i.email}`));
  console.log(`  Student     ${STUDENTS[0].email}  (strong)`);
  console.log(`  Student     ${STUDENTS[8].email}  (at risk)`);
  console.log(`  Students    firstname.lastname@northwind.edu (${STUDENTS.length} in total)\n`);
  /* eslint-enable no-console */
}

if (require.main === module) {
  main()
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error('Seed failed:', err.message); // eslint-disable-line no-console
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seed };
