// Embedded xkcd font advances for printable ASCII (32–126), in 856 units/em.
const advances = [
    256, 186, 262, 531, 458, 556, 506, 148, 288, 279, 514, 503, 217, 482, 175, 403,
    483, 150, 460, 479, 449, 522, 460, 441, 421, 444, 173, 224, 398, 535, 398, 428,
    536, 452, 431, 468, 500, 474, 493, 482, 432, 156, 551, 469, 449, 517, 454, 489,
    459, 578, 446, 467, 485, 454, 426, 621, 470, 521, 509, 326, 403, 348, 423, 511,
    428, 421, 368, 385, 428, 432, 463, 506, 358, 227, 358, 443, 171, 575, 370, 403,
    441, 472, 437, 382, 371, 419, 404, 466, 511, 438, 415, 286, 156, 303, 592
] as const

// Unsupported characters use the '?' advance (428).
export const measureXkcdText = (text: string, fontSize: number): number =>
    Array.from(text).reduce((width, char) => width + (advances[char.codePointAt(0)! - 32] ?? 428), 0) * fontSize / 856
