export type DemoAssessmentQuestion = {
  number: number;
  key: string;
  type: 'mc' | 'text';
  text: string;
  domain: string;
  options?: Record<string, string> | null;
  correctAnswer: string;
  acceptedAnswers?: string[] | null;
  explanation?: string | null;
};

export type DemoAssessment = {
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  instructions?: string;
  showStudentScore: boolean;
  questions: DemoAssessmentQuestion[];
};

export const PVHS_LEVEL1_ASSESSMENTS: DemoAssessment[] = [
  {
    slug: 'preclass_math',
    title: 'Pre-Class Welding Math Assessment',
    description: 'PVHS WLD 105 Day 1 baseline diagnostic used to identify support needs before the 45-Day Welding Mathematics sequence begins.',
    estimatedMinutes: 20,
    instructions: 'Complete all 20 questions. The instructor does not coach answers during this baseline assessment.',
    showStudentScore: true,
    questions: [
      { number: 1, key: 'q1', type: 'mc', text: 'Which of the following is equal to 1/2 inch in decimal form?', domain: 'Fractions & Decimals', options: { A: '0.25', B: '0.50', C: '0.75', D: '0.33' }, correctAnswer: 'B', explanation: '1 ÷ 2 = 0.50.' },
      { number: 2, key: 'q2', type: 'mc', text: 'What is 7/8 inch as a decimal?', domain: 'Fractions & Decimals', options: { A: '0.875', B: '0.625', C: '0.0875', D: '0.857' }, correctAnswer: 'A', explanation: '7 ÷ 8 = 0.875.' },
      { number: 3, key: 'q3', type: 'mc', text: 'Which fraction is the same as 0.375?', domain: 'Fractions & Decimals', options: { A: '3/8', B: '5/8', C: '7/8', D: '1/4' }, correctAnswer: 'A', explanation: '3 ÷ 8 = 0.375.' },
      { number: 4, key: 'q4', type: 'mc', text: 'Convert 0.625 inches to a fraction.', domain: 'Fractions & Decimals', options: { A: '5/8', B: '3/4', C: '7/8', D: '1/2' }, correctAnswer: 'A', explanation: '0.625 = 5/8.' },
      { number: 5, key: 'q5', type: 'mc', text: 'Which of the following is the smallest?', domain: 'Fractions & Decimals', options: { A: '1/8', B: '0.150', C: '3/16', D: '0.25' }, correctAnswer: 'A', explanation: '1/8 = 0.125.' },
      { number: 6, key: 'q6', type: 'mc', text: 'You have a piece of metal 12 inches long. You cut off 3 5/8 inches. How much remains?', domain: 'Shop Arithmetic', options: { A: '8 3/8 in', B: '9 1/2 in', C: '8 1/4 in', D: '8 5/8 in' }, correctAnswer: 'A', explanation: '12 - 3 5/8 = 8 3/8 inches.' },
      { number: 7, key: 'q7', type: 'mc', text: 'What is 3 3/4 in + 2 1/8 in?', domain: 'Shop Arithmetic', options: { A: '5 5/8 in', B: '5 7/8 in', C: '6 in', D: '6 1/4 in' }, correctAnswer: 'B', explanation: '3 6/8 + 2 1/8 = 5 7/8 inches.' },
      { number: 8, key: 'q8', type: 'mc', text: 'A weld joint needs a 1/4-inch gap, but the current gap is 3/8 inch. By how much must the gap be reduced?', domain: 'Shop Arithmetic', options: { A: '1/8 in', B: '1/4 in', C: '3/8 in', D: '1/16 in' }, correctAnswer: 'A', explanation: '3/8 - 1/4 = 1/8 inch.' },
      { number: 9, key: 'q9', type: 'mc', text: 'Multiply: 5 1/2 in × 2 = ?', domain: 'Shop Arithmetic', options: { A: '10 in', B: '11 in', C: '11 1/2 in', D: '12 in' }, correctAnswer: 'B', explanation: '5.5 × 2 = 11 inches.' },
      { number: 10, key: 'q10', type: 'mc', text: 'A 48-inch plate is cut into four equal parts. What is the length of each part?', domain: 'Shop Arithmetic', options: { A: '12 in', B: '10 in', C: '11.5 in', D: '12.5 in' }, correctAnswer: 'A', explanation: '48 ÷ 4 = 12 inches.' },
      { number: 11, key: 'q11', type: 'mc', text: 'On a tape measure divided into 1/16-inch increments, what measurement is the fourth small line after 3 inches?', domain: 'Tape & Measurement', options: { A: '3 1/4 in', B: '3 3/8 in', C: '3 5/16 in', D: '3 7/16 in' }, correctAnswer: 'A', explanation: 'Four 1/16-inch increments equal 1/4 inch.' },
      { number: 12, key: 'q12', type: 'mc', text: 'Which measurement is the longest?', domain: 'Tape & Measurement', options: { A: '7/16 in', B: '3/8 in', C: '1/2 in', D: '5/16 in' }, correctAnswer: 'C', explanation: '1/2 = 8/16.' },
      { number: 13, key: 'q13', type: 'mc', text: 'A weld bead must start at 10 7/8 inches. Where is that location on a tape measure divided into 1/16-inch increments?', domain: 'Tape & Measurement', options: { A: 'Two small lines before 11 in', B: 'One small line after 10 3/4 in', C: 'At 10 1/2 in', D: 'Halfway between 10 1/2 in and 11 in' }, correctAnswer: 'A', explanation: '10 7/8 = 10 14/16.' },
      { number: 14, key: 'q14', type: 'mc', text: 'How many 1/8-inch segments are in 1 inch?', domain: 'Tape & Measurement', options: { A: '4', B: '6', C: '8', D: '10' }, correctAnswer: 'C', explanation: '1 ÷ 1/8 = 8 segments.' },
      { number: 15, key: 'q15', type: 'mc', text: 'True or False: A tape measure marked in 1/16-inch increments divides each inch into 16 equal spaces.', domain: 'Tape & Measurement', options: { A: 'True', B: 'False' }, correctAnswer: 'A', explanation: 'Sixteen 1/16-inch spaces make one inch.' },
      { number: 16, key: 'q16', type: 'mc', text: 'Five holes are drilled evenly along an 18-inch plate, with the first hole at one end and the last hole at the other end. What is the spacing between adjacent holes?', domain: 'Layout, Area & Conversions', options: { A: '4 in', B: '3.5 in', C: '4.5 in', D: '3.6 in' }, correctAnswer: 'C', explanation: 'Five holes create four equal spaces. 18 ÷ 4 = 4.5 inches.' },
      { number: 17, key: 'q17', type: 'mc', text: 'Steel plate costs $0.30 per square inch. What is the material cost of a 12 in × 6 in piece?', domain: 'Layout, Area & Conversions', options: { A: '$2.10', B: '$18.00', C: '$21.60', D: '$19.50' }, correctAnswer: 'C', explanation: '72 × $0.30 = $21.60.' },
      { number: 18, key: 'q18', type: 'mc', text: 'A steel rod is 5 feet long. How many inches is that?', domain: 'Layout, Area & Conversions', options: { A: '50', B: '55', C: '60', D: '65' }, correctAnswer: 'C', explanation: '5 × 12 = 60 inches.' },
      { number: 19, key: 'q19', type: 'mc', text: 'A 36-inch bar is cut into 5 equal sections. What is the length of each section?', domain: 'Shop Arithmetic', options: { A: '6 in', B: '7 in', C: '7.2 in', D: '7.5 in' }, correctAnswer: 'C', explanation: '36 ÷ 5 = 7.2 inches.' },
      { number: 20, key: 'q20', type: 'text', text: 'What is the decimal equivalent of 9/16 inch?', domain: 'Fractions & Decimals', correctAnswer: '0.5625', acceptedAnswers: ['0.5625', '.5625', '0.56250', '.56250'], explanation: '9 ÷ 16 = 0.5625.' },
    ],
  },
  {
    slug: 'blueprint_day1',
    title: 'Blueprint Reading — Day 1 • Basic lines, views, notes, and dimensions',
    description: 'PVHS WLD 105 Day 5 connected blueprint assessment.',
    estimatedMinutes: 20,
    instructions: 'Use the assigned print packet for questions marked [Drawing]. Compare views, lines, notes, and dimensions before choosing an answer.',
    showStudentScore: true,
    questions: [
      { number: 1, key: 'd1q1', type: 'mc', text: '[Drawing] Refer to the V-Groove Test Block. Why are three views used to show the object?', domain: 'Day 1', options: { A: 'To give enough information about shape, size, and features that one view alone cannot show', B: 'To show three different material types', C: 'To give each welder a separate copy', D: 'To avoid using dimensions' }, correctAnswer: 'A' },
      { number: 2, key: 'd1q2', type: 'mc', text: '[Drawing] Which three standard orthographic views are typically shown for the V-Groove Test Block?', domain: 'Day 1', options: { A: 'Front, top, and right-side views', B: 'Isometric, exploded, and section views', C: 'Front, detail, and pictorial views', D: 'Top, bill of materials, and note view' }, correctAnswer: 'A' },
      { number: 3, key: 'd1q3', type: 'mc', text: '[Drawing] In standard orthographic projection, which two views show the same length?', domain: 'Day 1', options: { A: 'Front and top', B: 'Top and right side', C: 'Front and right side', D: 'Detail and section' }, correctAnswer: 'A' },
      { number: 4, key: 'd1q4', type: 'mc', text: '[Drawing] In standard orthographic projection, which two views show the same width or depth?', domain: 'Day 1', options: { A: 'Front and top', B: 'Top and right side', C: 'Front and right side', D: 'Front and detail' }, correctAnswer: 'B' },
      { number: 5, key: 'd1q5', type: 'mc', text: '[Drawing] In standard orthographic projection, which two views show the same height or thickness?', domain: 'Day 1', options: { A: 'Front and top', B: 'Top and right side', C: 'Front and right side', D: 'Top and detail' }, correctAnswer: 'C' },
      { number: 6, key: 'd1q6', type: 'mc', text: '[Drawing] What do the top and right-side views have in common with respect to the front view?', domain: 'Day 1', options: { A: 'They align with the front view to carry dimensions and features across', B: 'They are always drawn larger than the front view', C: 'They replace the need for notes', D: 'They remove hidden lines from the drawing' }, correctAnswer: 'A' },
      { number: 7, key: 'd1q7', type: 'mc', text: 'What is the main purpose of an object line on a print?', domain: 'Day 1', options: { A: 'To show visible edges and outlines of the part', B: 'To show center points only', C: 'To show cutting planes', D: 'To show dimensions only' }, correctAnswer: 'A' },
      { number: 8, key: 'd1q8', type: 'mc', text: 'What is the main purpose of a hidden line?', domain: 'Day 1', options: { A: 'To show edges or features not directly visible in that view', B: 'To show the outside shape only', C: 'To show the center of a hole', D: 'To show a finished weld contour' }, correctAnswer: 'A' },
      { number: 9, key: 'd1q9', type: 'mc', text: 'What does a centerline usually indicate?', domain: 'Day 1', options: { A: 'The center of a circular or symmetrical feature', B: 'The cutting direction for a saw', C: 'The surface finish required', D: 'The location of a title block' }, correctAnswer: 'A' },
      { number: 10, key: 'd1q10', type: 'mc', text: 'What is the job of a dimension line?', domain: 'Day 1', options: { A: 'To show the size or distance being measured', B: 'To show hidden edges', C: 'To show a material break', D: 'To show the order of welding' }, correctAnswer: 'A' },
      { number: 11, key: 'd1q11', type: 'mc', text: 'What is the job of an extension line?', domain: 'Day 1', options: { A: 'To extend from the feature out to the dimension line', B: 'To darken object lines', C: 'To replace leader lines', D: 'To show a weld contour' }, correctAnswer: 'A' },
      { number: 12, key: 'd1q12', type: 'mc', text: 'When a drawing includes notes or specifications, why must they be checked before fabrication starts?', domain: 'Day 1', options: { A: 'They may include instructions not obvious from the views alone', B: 'They are only for office filing', C: 'They are used only after welding is complete', D: 'They replace all dimensions on the print' }, correctAnswer: 'A' },
      { number: 13, key: 'd1q13', type: 'mc', text: 'A general specification placed in or near the title block usually applies to:', domain: 'Day 1', options: { A: 'All or several views on the drawing', B: 'Only the smallest detail view', C: 'Only the welder who signs first', D: 'Only one hidden feature' }, correctAnswer: 'A' },
      { number: 14, key: 'd1q14', type: 'mc', text: 'On a print, the diameter symbol tells the reader that the dimension refers to:', domain: 'Day 1', options: { A: 'The full distance across a circle', B: 'Half the distance across a circle', C: 'The length of a slot', D: 'The angle of a bevel' }, correctAnswer: 'A' },
      { number: 15, key: 'd1q15', type: 'mc', text: 'Which statement best describes why dimensions matter to welders and fabricators?', domain: 'Day 1', options: { A: 'Wrong dimensions affect fit-up, hole location, and final assembly', B: 'Dimensions only matter to machinists', C: 'Dimensions are optional if the shape looks right', D: 'Dimensions are used only for record keeping' }, correctAnswer: 'A' },
      { number: 16, key: 'd1q16', type: 'mc', text: 'If two group members disagree on what a dimension means, the best next step is to:', domain: 'Day 1', options: { A: 'Go back to the view, lines, and notes and prove the answer from the print', B: 'Choose the answer that sounds fastest', C: 'Ignore the dimension and move on', D: 'Let the loudest person decide' }, correctAnswer: 'A' },
      { number: 17, key: 'd1q17', type: 'mc', text: 'A reference dimension is usually included to:', domain: 'Day 1', options: { A: 'Provide extra information without controlling production size', B: 'Replace every required tolerance', C: 'Show hidden lines more clearly', D: 'Identify the drawing revision' }, correctAnswer: 'A' },
      { number: 18, key: 'd1q18', type: 'mc', text: 'Which print-reading habit is strongest when learning basic views?', domain: 'Day 1', options: { A: 'Compare all views before making a decision', B: 'Read only the front view', C: 'Ignore notes until the end', D: 'Assume every line means the same thing' }, correctAnswer: 'A' },
      { number: 19, key: 'd1q19', type: 'mc', text: 'If a hole appears as a circle in one view and as hidden edges in another view, that tells the reader that:', domain: 'Day 1', options: { A: 'The feature must be interpreted across more than one view', B: 'The print is automatically wrong', C: 'The hole is not really there', D: 'The dimensions can be ignored' }, correctAnswer: 'A' },
      { number: 20, key: 'd1q20', type: 'mc', text: 'Why is it dangerous to rely on one view alone when reading a fabrication print?', domain: 'Day 1', options: { A: 'One view rarely shows all surfaces, features, and dimensions clearly', B: 'One view always uses the wrong scale', C: 'One view cannot contain object lines', D: 'One view is only for inspectors' }, correctAnswer: 'A' },
    ],
  },
];
