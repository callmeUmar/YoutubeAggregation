import type { Sentiment } from '../api/types';

/**
 * Hand-written, fictional comment templates for DEMO DATA. None of these are
 * real YouTube comments. Each topic's `term` appears verbatim in its
 * templates so keyword counts and evidence always agree.
 */

export interface Topic {
  term: string;
  templates: Record<Sentiment, readonly string[]>;
}

export const TOPICS: readonly Topic[] = [
  {
    term: 'audio',
    templates: {
      praise: [
        'The audio on this one is so much cleaner. New mic?',
        'Finally the audio levels are consistent. Huge difference.',
        'Crisp audio, really easy to listen to on headphones.',
      ],
      neutral: [
        'What audio interface are you using these days?',
        'Is the audio recorded on the camera or separately?',
        'Would love a breakdown of your audio chain.',
      ],
      criticism: [
        'The audio keeps cutting out around the middle.',
        'Audio is way too quiet compared to the ads.',
        'Background hum in the audio was really distracting this time.',
      ],
    },
  },
  {
    term: 'editing',
    templates: {
      praise: [
        'The editing is so tight, not a second wasted.',
        'Whoever does your editing deserves a raise.',
        'Love the editing style on this series.',
      ],
      neutral: [
        'Do you do the editing yourself or is it outsourced?',
        'What software do you use for editing?',
        'How long does the editing take for one of these?',
      ],
      criticism: [
        'The editing feels rushed compared to older uploads.',
        'Too many jump cuts, the editing is a bit chaotic.',
        'Editing glitch at the halfway point, the cut comes way too early.',
      ],
    },
  },
  {
    term: 'thumbnail',
    templates: {
      praise: ['That thumbnail made me click instantly.', 'Clean thumbnail, no clickbait. Respect.'],
      neutral: ['Who designs the thumbnail for these?', 'Did you A/B test the thumbnail on this one?'],
      criticism: [
        'The thumbnail promised something the video never covered.',
        'Not a fan of the new thumbnail style, looks like every other channel.',
      ],
    },
  },
  {
    term: 'intro',
    templates: {
      praise: ['Short intro and straight to the point, love it.', 'That new intro is so satisfying.'],
      neutral: ['Is the intro music original?', 'Skipped the intro. Where does the main part start?'],
      criticism: ['The intro is way too long now.', 'Please bring back the old intro, this one drags.'],
    },
  },
  {
    term: 'sponsor',
    templates: {
      praise: ['Actually a sponsor I’d use, nice fit.', 'Respect for keeping the sponsor segment short.'],
      neutral: ['Is the sponsor code still valid?', 'Timestamp for after the sponsor segment?'],
      criticism: [
        'Third sponsor read this month, it’s getting to be a lot.',
        'The sponsor segment was longer than the actual tips.',
      ],
    },
  },
  {
    term: 'pacing',
    templates: {
      praise: ['The pacing on this was perfect, 20 minutes flew by.', 'Great pacing, never felt slow.'],
      neutral: ['Was the pacing intentionally slower for beginners?'],
      criticism: [
        'The pacing dragged in the second half.',
        'Pacing is too fast to follow along, I had to pause constantly.',
      ],
    },
  },
  {
    term: 'music',
    templates: {
      praise: ['The background music choice was spot on.', 'Music and visuals in the montage were perfect.'],
      neutral: ['What’s the music at 4:12?', 'Is the music royalty free? Would love to use it.'],
      criticism: [
        'Background music is louder than your voice at times.',
        'The music is distracting during the explanations.',
      ],
    },
  },
  {
    term: 'examples',
    templates: {
      praise: ['The real-world examples made it click for me.', 'More examples like these please, super helpful.'],
      neutral: ['Could you share the examples as a download?', 'Are the examples from your own projects?'],
      criticism: [
        'Needed more examples, the theory alone was hard to follow.',
        'The examples felt too basic for an advanced video.',
      ],
    },
  },
  {
    term: 'lighting',
    templates: {
      praise: ['The lighting looks so cinematic now.', 'Whatever you changed with the lighting, keep it.'],
      neutral: ['What lighting kit are you using in the new studio?'],
      criticism: ['The lighting flickers in a few shots.', 'Your face is really dark, the lighting was off this time.'],
    },
  },
  {
    term: 'subtitles',
    templates: {
      praise: [
        'Thank you for adding subtitles, it makes a huge difference for me.',
        'Accurate subtitles for once, appreciated.',
      ],
      neutral: ['Will subtitles be available in Spanish?', 'Are the subtitles auto-generated?'],
      criticism: ['The subtitles are out of sync for the whole video.', 'No subtitles on this one? Hard to follow.'],
    },
  },
  {
    term: 'length',
    templates: {
      praise: ['Perfect length, I can watch it on my lunch break.', 'Love the longer length, so much more depth.'],
      neutral: ['Any plans for a shorter version at this length?'],
      criticism: [
        'The video length could be cut in half without losing anything.',
        'Too much length for too little information.',
      ],
    },
  },
  {
    term: 'tutorial',
    templates: {
      praise: [
        'Best tutorial on this topic, bookmarked.',
        'Followed the tutorial step by step and it worked first try.',
      ],
      neutral: ['Will there be a part 2 of this tutorial?', 'Which version was used in this tutorial?'],
      criticism: ['The tutorial skips a few steps at the end.', 'The tutorial didn’t work for me on the latest version.'],
    },
  },
];

/** Comments that mention no tracked keyword. */
export const GENERIC_TEMPLATES: Record<Sentiment, readonly string[]> = {
  praise: [
    'This channel never misses.',
    'Instant like.',
    'Been watching since the early days, so proud of how far this has come.',
    'This deserves way more views.',
    'Genuinely one of the most useful channels out there.',
    'Watched twice, learned something new both times.',
  ],
  neutral: [
    'Here before it blows up.',
    'Who else is watching this at 2am?',
    'Anyone else here from the newsletter?',
    'Saving this for later.',
    'Commenting for the algorithm.',
    'Greetings from Lisbon!',
  ],
  criticism: [
    'Feels like the quality has dropped lately.',
    'This one felt like filler, honestly.',
    'Not as good as the older videos.',
    'Clickbait title, disappointed.',
    'The content has changed too much for me.',
  ],
};

const TITLE_OPENERS = [
  'How I',
  'Testing',
  'Why I stopped',
  'The truth about',
  'A beginner’s guide to',
  'I tried',
  'Ranking',
  'Fixing',
] as const;

const TITLE_SUBJECTS = [
  'my home studio',
  'budget microphones',
  'a 30-day editing challenge',
  'every camera I own',
  'channel thumbnails',
  'color grading',
  'vertical video',
  'the recommendation algorithm',
  'my upload schedule',
  'long-form content',
  'cheap lighting setups',
  'scripting a video',
] as const;

export function videoTitle(openerIndex: number, subjectIndex: number): string {
  const opener = TITLE_OPENERS[openerIndex % TITLE_OPENERS.length];
  const subject = TITLE_SUBJECTS[subjectIndex % TITLE_SUBJECTS.length];
  return `${opener} ${subject}`;
}

export const TITLE_COUNTS = { openers: TITLE_OPENERS.length, subjects: TITLE_SUBJECTS.length };

export const AUTHOR_PARTS = {
  first: ['quiet', 'pixel', 'lunar', 'cobalt', 'maple', 'neon', 'rusty', 'swift', 'urban', 'velvet', 'amber', 'north'],
  second: ['otter', 'fox', 'studio', 'maker', 'pilot', 'sketch', 'falcon', 'wave', 'byte', 'reader', 'tides', 'frame'],
} as const;
