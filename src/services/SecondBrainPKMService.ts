import {
  SecondBrainNote,
  BlockItem,
  InlineTaskItem,
  KnowledgeGraphLink,
  DiaryEntry,
  BookItem,
  BookQuoteBlock,
  KnowledgeItem,
  ReferenceLinkItem,
  DailyRecurringTask,
  ProjectItem,
  BrainstormCard,
  GeneralTodoItem,
  GlobalSearchResult,
  BlockFormattingStyle,
} from '../models/NoctisModels';
import { InputSanitizer } from '../security/InputSanitizer';

export class DailyTaskStatistics {
  public totalScheduledToday: number = 0;
  public completedToday: number = 0;
  public completionPercentage: number = 0;
  public sevenDayAveragePercentage: number = 0;
  public consistencyStreakDays: number = 0;

  constructor(init?: Partial<DailyTaskStatistics>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class SecondBrainPKMService {
  // ---------------- NOTE PKM HELPERS ----------------

  public static createNewNote(
    title: string = 'Untitled Mind Fragment',
    category: SecondBrainNote['paraCategory'] = 'inbox'
  ): SecondBrainNote {
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return new SecondBrainNote({
      id,
      title: InputSanitizer.sanitizeString(title),
      paraCategory: category,
      blocks: [
        new BlockItem({
          id: `blk_${Date.now()}_1`,
          type: 'text',
          content: 'Write freely or tap the formatting toolbar below...',
        }),
      ],
      wikiLinks: [],
      backlinks: [],
      tags: [],
      isPinned: false,
      isArchived: false,
      isEncrypted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // ---------------- BOOK & QUOTE HUB ----------------

  public static createNewBook(
    title: string,
    author: string,
    startDate: string,
    finishDate: string = '',
    isCurrentlyReading: boolean = true
  ): BookItem {
    const id = `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return new BookItem({
      id,
      title: InputSanitizer.sanitizeString(title) || 'Untitled Book',
      author: InputSanitizer.sanitizeString(author) || 'Unknown Author',
      startDate: startDate || new Date().toISOString().split('T')[0],
      finishDate: isCurrentlyReading ? '' : finishDate,
      isCurrentlyReading,
      blocks: [
        new BookQuoteBlock({
          id: `bq_${Date.now()}_1`,
          type: 'quote',
          content: 'Add an inspiring quote or key idea from the book here...',
          chapterOrPage: 'Chapter 1',
        }),
      ],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  public static addBookBlock(
    book: BookItem,
    type: 'quote' | 'note' | 'summary',
    content: string,
    chapterOrPage: string = '',
    style?: BlockFormattingStyle
  ): BookItem {
    const newBlock = new BookQuoteBlock({
      id: `bq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      content: InputSanitizer.sanitizeString(content),
      chapterOrPage: InputSanitizer.sanitizeString(chapterOrPage),
      style: style || new BlockFormattingStyle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return new BookItem({
      ...book,
      blocks: [...book.blocks, newBlock],
      updatedAt: Date.now(),
    });
  }

  // ---------------- KNOWLEDGE HUB ----------------

  public static createNewKnowledgeItem(topic: string, description: string): KnowledgeItem {
    const id = `kno_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return new KnowledgeItem({
      id,
      topic: InputSanitizer.sanitizeString(topic) || 'New Knowledge Topic',
      description: InputSanitizer.sanitizeString(description),
      blocks: [
        new BlockItem({
          id: `blk_${Date.now()}_k1`,
          type: 'text',
          content: InputSanitizer.sanitizeString(description),
        }),
      ],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // ---------------- REFERENCE LINKS HUB ----------------

  public static createNewReferenceLink(title: string, description: string, rawUrl: string): ReferenceLinkItem {
    const id = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const safeUrl = InputSanitizer.sanitizeSafeUrl(rawUrl);
    return new ReferenceLinkItem({
      id,
      title: InputSanitizer.sanitizeString(title) || 'Untitled Reference',
      description: InputSanitizer.sanitizeString(description),
      url: safeUrl,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // ---------------- DAILY TASK TRACKER & ROUTINE SCHEDULER ----------------

  public static createRecurringTask(
    title: string,
    daysOfWeek: number[], // 0=Sun, 1=Mon, ..., 6=Sat
    note: string = ''
  ): DailyRecurringTask {
    const id = `rtask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return new DailyRecurringTask({
      id,
      title: InputSanitizer.sanitizeString(title) || 'Daily Habit / Task',
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
      note: InputSanitizer.sanitizeString(note),
      isActive: true,
      createdAt: Date.now(),
    });
  }

  public static getTasksForDate(
    tasks: DailyRecurringTask[],
    dateKey: string
  ): DailyRecurringTask[] {
    try {
      const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc.

      return tasks.filter((t) => t.isActive && t.daysOfWeek.includes(dayOfWeek));
    } catch {
      return tasks.filter((t) => t.isActive);
    }
  }

  public static calculateDailyTaskStatistics(
    tasks: DailyRecurringTask[],
    completions: { [dateKey: string]: { [taskId: string]: boolean } },
    selectedDateKey: string
  ): DailyTaskStatistics {
    const scheduledForSelectedDay = this.getTasksForDate(tasks, selectedDateKey);
    const dayCompletions = completions[selectedDateKey] || {};

    const totalScheduled = scheduledForSelectedDay.length;
    let completedCount = 0;
    for (const task of scheduledForSelectedDay) {
      if (dayCompletions[task.id]) {
        completedCount++;
      }
    }

    const percentage = totalScheduled > 0 ? Math.round((completedCount / totalScheduled) * 100) : 0;

    // Calculate 7-day average
    let sevenDayTotalScheduled = 0;
    let sevenDayCompleted = 0;
    const [y, m, d] = selectedDateKey.split('-').map((v) => parseInt(v, 10));
    const iterDate = new Date(y, m - 1, d);

    for (let i = 0; i < 7; i++) {
      const yr = iterDate.getFullYear();
      const mo = String(iterDate.getMonth() + 1).padStart(2, '0');
      const da = String(iterDate.getDate()).padStart(2, '0');
      const key = `${yr}-${mo}-${da}`;

      const scheduled = this.getTasksForDate(tasks, key);
      const comps = completions[key] || {};
      sevenDayTotalScheduled += scheduled.length;
      for (const t of scheduled) {
        if (comps[t.id]) {
          sevenDayCompleted++;
        }
      }
      iterDate.setDate(iterDate.getDate() - 1);
    }

    const sevenDayAvg =
      sevenDayTotalScheduled > 0
        ? Math.round((sevenDayCompleted / sevenDayTotalScheduled) * 100)
        : 0;

    // Calculate consistency streak
    let streak = 0;
    const streakIter = new Date(y, m - 1, d);
    while (true) {
      const yr = streakIter.getFullYear();
      const mo = String(streakIter.getMonth() + 1).padStart(2, '0');
      const da = String(streakIter.getDate()).padStart(2, '0');
      const key = `${yr}-${mo}-${da}`;

      const scheduled = this.getTasksForDate(tasks, key);
      if (scheduled.length === 0) {
        // Rest day or unscheduled day doesn't break streak if at least 1 streak day exists
        streakIter.setDate(streakIter.getDate() - 1);
        if (streak > 0) continue;
        break;
      }

      const comps = completions[key] || {};
      const allDone = scheduled.every((t) => comps[t.id]);
      if (allDone) {
        streak++;
        streakIter.setDate(streakIter.getDate() - 1);
      } else {
        break;
      }
    }

    return new DailyTaskStatistics({
      totalScheduledToday: totalScheduled,
      completedToday: completedCount,
      completionPercentage: percentage,
      sevenDayAveragePercentage: sevenDayAvg,
      consistencyStreakDays: streak,
    });
  }

  // ---------------- PROJECTS & BRAINSTORM CARDS ----------------

  public static createNewProject(name: string, description: string = ''): ProjectItem {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return new ProjectItem({
      id,
      name: InputSanitizer.sanitizeString(name) || 'Untitled Project',
      description: InputSanitizer.sanitizeString(description),
      status: 'active',
      cards: [
        new BrainstormCard({
          id: `card_${Date.now()}_1`,
          title: 'Initial Brainstorm',
          content: 'Capture core objectives, hypotheses, or milestones...',
          colorTag: '#E2A154',
          blocks: [
            new BlockItem({
              id: `blk_${Date.now()}_p1`,
              type: 'text',
              content: 'Core idea and brainstorm points...',
            }),
          ],
        }),
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  public static addBrainstormCard(
    project: ProjectItem,
    title: string,
    content: string,
    colorTag: string = '#E2A154'
  ): ProjectItem {
    const newCard = new BrainstormCard({
      id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: InputSanitizer.sanitizeString(title) || 'Idea Card',
      content: InputSanitizer.sanitizeString(content),
      colorTag: InputSanitizer.sanitizeColorHex(colorTag, '#E2A154'),
      blocks: [
        new BlockItem({
          id: `blk_${Date.now()}_c1`,
          type: 'text',
          content: InputSanitizer.sanitizeString(content),
        }),
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return new ProjectItem({
      ...project,
      cards: [...project.cards, newCard],
      updatedAt: Date.now(),
    });
  }

  // ---------------- GLOBAL BREADCRUMB SEARCH ENGINE ----------------

  public static executeGlobalSearch(
    query: string,
    vault: {
      books?: BookItem[];
      knowledgeItems?: KnowledgeItem[];
      referenceLinks?: ReferenceLinkItem[];
      dailyRecurringTasks?: DailyRecurringTask[];
      projects?: ProjectItem[];
      diaryEntries?: DiaryEntry[];
      secondBrainNotes?: SecondBrainNote[];
      generalTodos?: GeneralTodoItem[];
    }
  ): GlobalSearchResult[] {
    const sanitizedQuery = InputSanitizer.sanitizeString(query).toLowerCase().trim();
    if (!sanitizedQuery || sanitizedQuery.length < 2) {
      return [];
    }

    const results: GlobalSearchResult[] = [];

    // 1. Search Books & Book Blocks
    for (const book of vault.books || []) {
      const bookTitleMatch = book.title.toLowerCase().includes(sanitizedQuery);
      const bookAuthorMatch = book.author.toLowerCase().includes(sanitizedQuery);

      if (bookTitleMatch || bookAuthorMatch) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${book.id}`,
            title: book.title,
            snippet: `Author: ${book.author} (${book.isCurrentlyReading ? 'Currently Reading' : `${book.startDate} - ${book.finishDate}`})`,
            breadcrumbs: ['Second Brain', 'Books', book.title],
            module: 'books',
            targetId: book.id,
            matchedKeyword: sanitizedQuery,
          })
        );
      }

      for (const block of book.blocks) {
        if (block.content.toLowerCase().includes(sanitizedQuery)) {
          results.push(
            new GlobalSearchResult({
              id: `sr_${block.id}`,
              title: `${book.title} (by ${book.author})`,
              snippet: `${block.chapterOrPage ? `[${block.chapterOrPage}] ` : ''}"${block.content}"`,
              breadcrumbs: ['Second Brain', 'Books', `${book.title} (${book.author})`, block.type === 'quote' ? 'Quote Block' : 'Note Block'],
              module: 'books',
              targetId: book.id,
              subId: block.id,
              matchedKeyword: sanitizedQuery,
            })
          );
        }
      }
    }

    // 2. Search Knowledge Hub
    for (const item of vault.knowledgeItems || []) {
      const topicMatch = item.topic.toLowerCase().includes(sanitizedQuery);
      const descMatch = item.description.toLowerCase().includes(sanitizedQuery);
      const blockMatch = item.blocks.some((b) => b.content.toLowerCase().includes(sanitizedQuery));

      if (topicMatch || descMatch || blockMatch) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${item.id}`,
            title: item.topic,
            snippet: item.description || item.blocks.map((b) => b.content).join(' '),
            breadcrumbs: ['Second Brain', 'Knowledge', item.topic],
            module: 'knowledge',
            targetId: item.id,
            matchedKeyword: sanitizedQuery,
          })
        );
      }
    }

    // 3. Search Important Links
    for (const link of vault.referenceLinks || []) {
      if (
        link.title.toLowerCase().includes(sanitizedQuery) ||
        link.description.toLowerCase().includes(sanitizedQuery) ||
        link.url.toLowerCase().includes(sanitizedQuery)
      ) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${link.id}`,
            title: link.title,
            snippet: `${link.description} — ${link.url}`,
            breadcrumbs: ['Second Brain', 'Links & References', link.title],
            module: 'links',
            targetId: link.id,
            matchedKeyword: sanitizedQuery,
          })
        );
      }
    }

    // 4. Search Daily Tasks
    for (const task of vault.dailyRecurringTasks || []) {
      if (
        task.title.toLowerCase().includes(sanitizedQuery) ||
        (task.note && task.note.toLowerCase().includes(sanitizedQuery))
      ) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${task.id}`,
            title: task.title,
            snippet: task.note || 'Scheduled daily routine task',
            breadcrumbs: ['Second Brain', 'Daily Task Tracker', task.title],
            module: 'daily_tasks',
            targetId: task.id,
            matchedKeyword: sanitizedQuery,
          })
        );
      }
    }

    // 5. Search Projects & Cards
    for (const project of vault.projects || []) {
      if (
        project.name.toLowerCase().includes(sanitizedQuery) ||
        project.description.toLowerCase().includes(sanitizedQuery)
      ) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${project.id}`,
            title: project.name,
            snippet: project.description || `Project with ${project.cards.length} cards`,
            breadcrumbs: ['Second Brain', 'Projects', project.name],
            module: 'projects',
            targetId: project.id,
            matchedKeyword: sanitizedQuery,
          })
        );
      }

      for (const card of project.cards) {
        if (
          card.title.toLowerCase().includes(sanitizedQuery) ||
          card.content.toLowerCase().includes(sanitizedQuery) ||
          card.blocks.some((b) => b.content.toLowerCase().includes(sanitizedQuery))
        ) {
          results.push(
            new GlobalSearchResult({
              id: `sr_${card.id}`,
              title: card.title,
              snippet: card.content || card.blocks.map((b) => b.content).join(' '),
              breadcrumbs: ['Second Brain', 'Projects', project.name, card.title],
              module: 'projects',
              targetId: project.id,
              subId: card.id,
              matchedKeyword: sanitizedQuery,
            })
          );
        }
      }
    }

    // 6. Search Daily Journal
    for (const diary of vault.diaryEntries || []) {
      const allText = [
        ...diary.morningIntentions,
        ...diary.dailyLog,
        ...diary.eveningReflection,
      ]
        .map((b) => b.content)
        .join(' ');

      if (diary.title.toLowerCase().includes(sanitizedQuery) || allText.toLowerCase().includes(sanitizedQuery)) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${diary.id}`,
            title: diary.title,
            snippet: allText.slice(0, 160) + '...',
            breadcrumbs: ['Daily Journal', diary.dateKey, diary.title],
            module: 'journal',
            targetId: diary.dateKey,
            matchedKeyword: sanitizedQuery,
          })
        );
      }
    }

    // 7. Search General To-Dos
    for (const todo of vault.generalTodos || []) {
      if (
        todo.title.toLowerCase().includes(sanitizedQuery) ||
        (todo.details && todo.details.toLowerCase().includes(sanitizedQuery))
      ) {
        results.push(
          new GlobalSearchResult({
            id: `sr_${todo.id}`,
            title: todo.title,
            snippet: `${todo.completed ? '[Completed] ' : ''}${todo.details || ''} ${todo.dueDate ? `(Due: ${todo.dueDate})` : ''}`,
            breadcrumbs: ['General To-Dos', todo.completed ? 'Finished' : 'Active', todo.title],
            module: 'todos',
            targetId: todo.id,
            matchedKeyword: sanitizedQuery,
          })
        );
      }
    }

    return results;
  }

  // ---------------- WIKILINKS & GRAPH ----------------

  public static extractWikiLinks(blocks: BlockItem[]): string[] {
    const linkSet = new Set<string>();
    const wikiRegex = /\[\[(.*?)\]\]/g;

    for (const block of blocks) {
      if (typeof block.content === 'string') {
        let match: RegExpExecArray | null;
        while ((match = wikiRegex.exec(block.content)) !== null) {
          const target = match[1]?.trim();
          if (target && target.length > 0) {
            linkSet.add(InputSanitizer.sanitizeString(target));
          }
        }
      }
    }
    return Array.from(linkSet);
  }

  public static recomputeBacklinks(notes: SecondBrainNote[]): SecondBrainNote[] {
    const titleToIdMap = new Map<string, string>();
    for (const note of notes) {
      titleToIdMap.set(note.title.toLowerCase().trim(), note.id);
    }

    const backlinkMap = new Map<string, Set<string>>();
    for (const note of notes) {
      backlinkMap.set(note.id, new Set<string>());
    }

    for (const sourceNote of notes) {
      const links = this.extractWikiLinks(sourceNote.blocks);
      sourceNote.wikiLinks = links;

      for (const linkTitle of links) {
        const targetId = titleToIdMap.get(linkTitle.toLowerCase().trim());
        if (targetId && targetId !== sourceNote.id) {
          backlinkMap.get(targetId)?.add(sourceNote.title);
        }
      }
    }

    for (const note of notes) {
      const incoming = backlinkMap.get(note.id);
      note.backlinks = incoming ? Array.from(incoming) : [];
    }

    return notes;
  }

  public static extractAllInlineTasks(
    notes: SecondBrainNote[],
    diaryEntries: DiaryEntry[],
    generalTodos: GeneralTodoItem[] = []
  ): InlineTaskItem[] {
    const tasks: InlineTaskItem[] = [];

    // Extract from Notes
    for (const note of notes) {
      for (const block of note.blocks) {
        if (block.type === 'todo') {
          tasks.push(
            new InlineTaskItem({
              id: block.id,
              sourceId: note.id,
              sourceType: 'note',
              sourceTitle: note.title,
              text: block.content,
              completed: Boolean(block.checked),
              createdAt: block.createdAt,
              completedAt: block.checked ? block.updatedAt : undefined,
            })
          );
        }
      }
    }

    // Extract from Diary Entries
    for (const diary of diaryEntries) {
      const allBlocks = [
        ...diary.morningIntentions,
        ...diary.dailyLog,
        ...diary.eveningReflection,
      ];
      for (const block of allBlocks) {
        if (block.type === 'todo') {
          tasks.push(
            new InlineTaskItem({
              id: block.id,
              sourceId: diary.id,
              sourceType: 'diary',
              sourceTitle: `Diary: ${diary.title}`,
              text: block.content,
              completed: Boolean(block.checked),
              createdAt: block.createdAt,
              completedAt: block.checked ? block.updatedAt : undefined,
            })
          );
        }
      }
    }

    // Extract from General To-Dos
    for (const todo of generalTodos) {
      tasks.push(
        new InlineTaskItem({
          id: todo.id,
          sourceId: todo.id,
          sourceType: 'general',
          sourceTitle: 'General To-Do',
          text: todo.title,
          completed: todo.completed,
          dueDate: todo.dueDate,
          createdAt: todo.createdAt,
          completedAt: todo.completedAt,
        })
      );
    }

    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  public static buildKnowledgeGraph(
    notes: SecondBrainNote[],
    diaryEntries: DiaryEntry[],
    books: BookItem[] = [],
    projects: ProjectItem[] = []
  ): {
    nodes: Array<{ id: string; label: string; type: 'note' | 'diary' | 'book' | 'project'; category?: string }>;
    links: KnowledgeGraphLink[];
  } {
    const nodes: Array<{ id: string; label: string; type: 'note' | 'diary' | 'book' | 'project'; category?: string }> = [];
    const links: KnowledgeGraphLink[] = [];
    const titleToIdMap = new Map<string, string>();

    for (const note of notes) {
      nodes.push({
        id: note.id,
        label: note.title,
        type: 'note',
        category: note.paraCategory,
      });
      titleToIdMap.set(note.title.toLowerCase().trim(), note.id);
    }

    for (const diary of diaryEntries) {
      nodes.push({
        id: diary.id,
        label: `📅 ${diary.dateKey}`,
        type: 'diary',
      });
    }

    for (const book of books) {
      nodes.push({
        id: book.id,
        label: `📚 ${book.title}`,
        type: 'book',
      });
    }

    for (const project of projects) {
      nodes.push({
        id: project.id,
        label: `🚀 ${project.name}`,
        type: 'project',
      });
    }

    for (const note of notes) {
      const wikiLinks = this.extractWikiLinks(note.blocks);
      for (const targetTitle of wikiLinks) {
        const targetId = titleToIdMap.get(targetTitle.toLowerCase().trim());
        if (targetId && targetId !== note.id) {
          links.push(
            new KnowledgeGraphLink({
              sourceId: note.id,
              targetId,
              label: 'references',
              strength: 1.5,
            })
          );
        }
      }
    }

    return { nodes, links };
  }
}
