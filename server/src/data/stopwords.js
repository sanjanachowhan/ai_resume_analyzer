// Words ignored when picking "top terms" from a job description.
export const STOPWORDS = new Set(`
a about above across after all also an and any are as at be been being but by can could do does each etc
for from has have having how if in including into is it its may more most must need needs new no not of on
one or other our out over per role should so such than that the their them then there these they this those
through to up us use used using via was we well what when where which while who will with within without would you your
ability able strong required requirements requirement preferred experience experienced work working works team teams
skills skill years year company position candidate candidates looking job responsibilities responsibility
excellent good great plus knowledge understanding familiarity proven demonstrated related relevant
including include includes etc join opportunity opportunities help helps ensure ensuring build building
develop developing development create creating support supporting provide providing part full time
day days week weeks business based high level highly like make making take taking able across
`.split(/\s+/).filter(Boolean));
