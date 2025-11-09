// Enhanced debug version of processDueDates function
// This will help us trace exactly what's happening in the due dates processing

const processDueDatesDebug = async (app, dataviewApi, params) => {
  console.log('=== PROCESS DUE DATES DEBUG START ===');
  console.log('Input params:', JSON.stringify(params, null, 2));
  
  const { courseId, start, end, query } = params;
  const entries = [];

  // Determine the start and end dates using your processDueDates.js logic
  const startDate = start || moment().subtract(1, 'day').format('YYYY-MM-DD');
  const endDate = end || moment().add(1, 'year').format('YYYY-MM-DD'); // Extended range to include future dates

  console.log('Date ranges:', { startDate, endDate });

  // Use dv.pages() like the original processDueDates.js
  // Handle both courseId-based queries and tag-based queries
  let pages;
  if (query && query.startsWith('#')) {
    // Handle tag-based queries like #education
    pages = dataviewApi.pages(`"${query}"`);
  } else if (courseId) {
    // Handle courseId-based queries
    pages = dataviewApi.pages(`"${courseId}"`);
  } else {
    // Get all pages
    pages = dataviewApi.pages();
  }
  
  console.log('Total pages found:', pages.length);

  // Filter like original code: exclude the courseId file itself and non-markdown files
  const filteredPages = pages.filter((p) => 
    (!courseId || p.file.name !== courseId) && 
    p.file.ext == "md"
  );
  
  console.log('Filtered pages count:', filteredPages.length);

  // Apply query filtering if provided
  let finalPages = filteredPages;
  if (query) {
    const searchTerm = query.toLowerCase();
    finalPages = filteredPages.filter((p) => {
      const fileName = p.file.name.toLowerCase();
      const filePath = p.file.path.toLowerCase();
      return fileName.includes(searchTerm) || filePath.includes(searchTerm);
    });
  }
  
  console.log('Final pages after query filtering:', finalPages.length);

  // Process each page that matches the course filter
  for (const page of finalPages) {
    console.log(`\n--- Processing page: ${JSON.stringify(page, null, 2)} ---`);
    
    if (!page.file?.path) {
      console.log(`Skipping page - no file.path: ${JSON.stringify(page)}`);
      continue;
    }

    try {
      // Read the file content to parse the markdown table
      const file = app.vault.getAbstractFileByPath(page.file.path);
      if (!(file instanceof TFile)) {
        console.log(`Skipping - not a TFile: ${page.file.path}`);
        continue;
      }

      console.log(`Reading file: ${page.file.path}`);
      const content = await app.vault.read(file);
      console.log(`File content length: ${content.length}`);
      
      // Parse the # Due Dates section using your regex pattern
      const regex = /# Due Dates([\s\S]*?)(?=\n#|$)/;
      const matches = content.match(regex);
      
      if (!matches) {
        console.log(`No "Due Dates" section found in ${page.file.path}`);
        console.log(`First 500 chars of content: ${content.substring(0, 500)}`);
        continue;
      }

      console.log(`Found Due Dates section in ${page.file.path}`);
      const tableData = matches[1].trim();
      console.log(`Table data: "${tableData}"`);
      
      const lines = tableData.split('\n').slice(1); // Skip header row
      console.log(`Found ${lines.length} data lines in table`);

      for (const line of lines) {
        console.log(`Processing line: "${line}"`);
        const columns = line
          .split('|')
          .map(c => c.trim())
          .filter(c => c);

        console.log(`Parsed columns: ${JSON.stringify(columns)}`);
        if (columns.length < 2) {
          console.log(`Skipping - insufficient columns`);
          continue;
        }

        let [dueDate, assignment] = columns;
        console.log(`Extracted: dueDate="${dueDate}", assignment="${assignment}"`);
        
        // Skip invalid dates and completed items (✅)
        const isValidDate = !isNaN(Date.parse(dueDate));
        const isCompleted = assignment?.includes('✅');
        
        console.log(`Valid date: ${isValidDate}, Completed: ${isCompleted}`);
        
        if (!isValidDate || isCompleted) {
          console.log(`Skipping - invalid date or completed`);
          continue;
        }

        // Apply date filtering - ONLY if explicit date range was provided
        // If no date range specified, include ALL future due dates
        const dueDateObj = moment(dueDate);
        const startObj = moment(startDate);
        const endObj = moment(endDate);

        console.log(`Date objects created: due=${dueDateObj.format()}, start=${startObj.format()}, end=${endObj.format()}`);

        // Only apply date filtering if user explicitly provided date parameters
        // OR if we're using default behavior (include all uncompleted due dates)
        if (start || end) {
          // User provided explicit date range - apply filtering
          if (!dueDateObj.isBetween(startObj, endObj, 'day', '[]')) {
            console.log(`Date ${dueDate} not in range ${startDate} to ${endDate}`);
            continue;
          }
        } else {
          // No explicit date range - only filter out past dates that are too old
          // Allow all future due dates and recent past due dates
          if (dueDateObj.isBefore(moment().subtract(30, 'days'))) {
            console.log(`Date ${dueDate} is too far in the past`);
            continue;
          }
        }

        // Apply query filtering
        if (query && !assignment.toLowerCase().includes(query.toLowerCase())) {
          console.log(`Assignment "${assignment}" doesn't match query "${query}"`);
          continue;
        }

        // Format assignment with course prefix (from your logic)
        const courseIdValue = page.course_id || courseId || 'unknown';
        const formattedAssignment = assignment.match(/[A-Z]{3}-[0-9]{3}/)
          ? assignment
          : `#${courseIdValue} - ${assignment}`;

        // Format due date based on your logic using moment.js
        let formattedDueDate = dueDate;
        if (dueDateObj.isAfter(moment().subtract(1, 'week'))) {
          formattedDueDate = `<span class="due one_week">${dueDate}</span>`;
        } else if (dueDateObj.isAfter(moment().subtract(2, 'week'))) {
          formattedDueDate = `<span class="due two_weeks">${dueDate}</span>`;
        }
        
        console.log(`Adding entry: ${dueDate}, ${assignment}`);
        // Add the entry
        entries.push({
          dueDate,
          formattedDueDate,
          assignment: formattedAssignment,
          filePath: page.file.path
        });
      }

    } catch (error) {
      console.error(`Error processing file ${page.file.path}:`, error);
    }
  }

  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`Total entries found: ${entries.length}`);
  console.log('All entries:', JSON.stringify(entries, null, 2));
  
  // Sort by due date
  entries.sort((a, b) => moment(a.dueDate).valueOf() - moment(b.dueDate).valueOf());

  console.log('=== PROCESS DUE DATES DEBUG END ===');
  return entries;
};

module.exports = { processDueDatesDebug };