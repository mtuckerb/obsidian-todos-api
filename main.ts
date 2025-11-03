import { App, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Plugin settings interface
interface TodosApiSettings {
	defaultSection: string;
	dailyNotesPath: string;
	excludedDirectories: string;
}

const DEFAULT_SETTINGS: TodosApiSettings = {
	defaultSection: '# Observations',
	dailyNotesPath: 'Daily Notes',
	excludedDirectories: 'Timeless,Archive'
}

// Extend the Obsidian App type to include plugins
interface ObsidianApp extends App {
	plugins: {
		plugins: {
			'obsidian-local-rest-api'?: any;
			dataview?: {
				api: any;
			};
		};
	};
}

// Type definitions for the Local REST API
interface LocalRestApiPublicApi {
	addRoute(path: string): any; // Express IRoute
	unregister(): void;
}

export default class TodosApiPlugin extends Plugin {
	private api: LocalRestApiPublicApi;
	settings: TodosApiSettings;

	async onload() {
		console.log('Loading Todos REST API plugin');

		// Load settings
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new TodosApiSettingTab(this.app, this));

		// Access the local-rest-api plugin directly instead of importing
		const app = this.app as ObsidianApp;
		const localRestApiPlugin = app.plugins.plugins['obsidian-local-rest-api'];
		
		if (!localRestApiPlugin) {
			console.error('Local REST API plugin is not available');
			return;
		}

		// Call getPublicApi method on the plugin
		this.api = localRestApiPlugin.getPublicApi(this.manifest);
		
		if (!this.api) {
			console.error('Failed to get Local REST API');
			return;
		}

		// Register the GET /todos route
		this.api.addRoute('/todos/').get(async (request: any, response: any) => {
			try {
				// Check if Dataview is available
				const app = this.app as ObsidianApp;
				const dataviewPlugin = app.plugins.plugins.dataview;
				if (!dataviewPlugin) {
					return response.status(503).json({
						error: 'Dataview plugin not found',
						message: 'Please install and enable the Dataview plugin'
					});
				}

				const dataviewApi = dataviewPlugin.api;
				if (!dataviewApi) {
					return response.status(503).json({
						error: 'Dataview API not available',
						message: 'Dataview plugin may not be fully loaded'
					});
				}

				// Query for all tasks
				const result = await dataviewApi.query('TASK');

				if (!result.successful) {
					return response.status(500).json({
						error: 'Query failed',
						message: result.error
					});
				}

				if (result.value.type !== 'task') {
					return response.status(500).json({
						error: 'Unexpected result type',
						message: `Expected task result, got ${result.value.type}`
					});
				}

				// Extract tasks from the Grouping structure
				const tasks = this.flattenTasks(result.value.values);

				// Parse query parameters for filtering
				const params = new URLSearchParams(request.url.split('?')[1] || '');
				const filterCompleted = params.get('completed');
				const filterPath = params.get('path');
				const filterTag = params.get('tag');
				const filterStatus = params.get('status');
				const excludeDirs = params.get('exclude')?.split(',').map(d => d.trim()) || 
								   this.settings.excludedDirectories.split(',').map(d => d.trim());

				// Apply filters
				let filteredTasks = tasks;

				if (filterCompleted !== null) {
					const showCompleted = filterCompleted === 'true';
					filteredTasks = filteredTasks.filter(task => task.completed === showCompleted);
				}

				if (filterPath) {
					filteredTasks = filteredTasks.filter(task => 
						task.path.includes(filterPath)
					);
				}

				if (filterTag) {
					filteredTasks = filteredTasks.filter(task => 
						task.tags && task.tags.some((tag: string) => tag.includes(filterTag))
					);
				}

				if (filterStatus) {
					filteredTasks = filteredTasks.filter(task => task.status === filterStatus);
				}

				if (excludeDirs && excludeDirs.length > 0 && excludeDirs[0] !== '') {
					filteredTasks = filteredTasks.filter(task => 
						!excludeDirs.some(dir => task.path.startsWith(dir))
					);
				}

				// Return the filtered tasks
				return response.status(200).json({
					count: filteredTasks.length,
					tasks: filteredTasks
				});

			} catch (error) {
				console.error('Error fetching todos:', error);
				return response.status(500).json({
					error: 'Internal server error',
					message: error.message
				});
			}
		});

		// Register POST /todos route for adding todos

		// Register POST /due-dates route for DataView-based due dates processing
		this.api.addRoute('/due-dates').post(async (request: any, response: any) => {
			try {
				const app = this.app as ObsidianApp;
				
				// Check if Dataview plugin is available
				const dataviewPlugin = app.plugins.plugins.dataview;
				if (!dataviewPlugin) {
					return response.status(503).json({
						error: 'Dataview plugin not found',
						message: 'Please install and enable the Dataview plugin'
					});
				}

				const dataviewApi = dataviewPlugin.api;
				if (!dataviewApi) {
					return response.status(503).json({
						error: 'Dataview API not available',
						message: 'Dataview plugin may not be fully loaded'
					});
				}

				// Parse request body with DataView integration parameters
				const body = request.body;
				const courseId = body.courseId;
				const start = body.start;
				const end = body.end;
				const query = body.query || '""';

				// Implement processDueDates.js logic
				const entries = await this.processDueDates(app, dataviewApi, {
					courseId,
					start,
					end,
					query
				});

				// Return the processed entries
				return response.status(200).json({
					count: entries.length,
					entries: entries
				});

			} catch (error) {
				console.error('Error processing due dates:', error);
				return response.status(500).json({
					error: 'Internal server error',
					message: error.message
				});
			}
		});

		this.api.addRoute('/todos/').post(async (request: any, response: any) => {
			try {
				const app = this.app as ObsidianApp;

				// Parse request body
				const body = request.body;
				const text = body.text;
				const status = body.status || ' ';
				const filePath = body.path || this.getCurrentDailyNotePath();

				if (!text) {
					return response.status(400).json({
						error: 'Missing required field',
						message: 'Text field is required'
					});
				}

				// Get or create the file
				let file = app.vault.getAbstractFileByPath(filePath);
				
				if (!file) {
					return response.status(404).json({
						error: 'File not found',
						message: `Could not find file: ${filePath}`
					});
				}
				if (!(file instanceof TFile)) {
					return response.status(400).json({
						error: 'Invalid path',
						message: `Path is not a file: ${filePath}`
					});
				}

				// Read the file content
				const content = await app.vault.read(file);

				// Find the target section
				const sectionHeader = this.settings.defaultSection;
				if (!content.includes(sectionHeader)) {
					return response.status(400).json({
						error: 'Section not found',
						message: `Could not find "${sectionHeader}" section in the file`
					});
				}

				// Create the task line
				const taskLine = `\t- [${status}] ${text}`;

				// Insert the task after the section header
				const lines = content.split('\n');
				const sectionIndex = lines.findIndex(line => line.trim() === sectionHeader);
				
				// Insert after the section header
				lines.splice(sectionIndex + 1, 0, taskLine);
				const newContent = lines.join('\n');

				// Save the file
				await app.vault.modify(file, newContent);

				// Return success response
				return response.status(201).json({
					message: 'Todo added successfully',
					path: filePath,
					text: text
				});

			} catch (error) {
				console.error('Error adding todo:', error);
				return response.status(500).json({
					error: 'Internal server error',
					message: error.message
				});
			}
		});

		// Register PATCH /todos route for updating todos
		this.api.addRoute('/todos/').patch(async (request: any, response: any) => {
			try {
				const app = this.app as ObsidianApp;

				// Parse request body
				const body = request.body;
				const path = body.path;
				const oldText = body.oldText;
				const newText = body.newText;
				const oldStatus = body.oldStatus || ' ';
				const newStatus = body.newStatus || oldStatus;

				if (!path || !oldText || !newText) {
					return response.status(400).json({
						error: 'Missing required fields',
						message: 'path, oldText, and newText are required'
					});
				}

				// Get the file
				const file = app.vault.getAbstractFileByPath(path);
				if (!file) {
					return response.status(404).json({
						error: 'File not found',
						message: `Could not find file: ${path}`
					});
				}
				if (!(file instanceof TFile)) {
					return response.status(400).json({
						error: 'Invalid path',
						message: `Path is not a file: ${path}`
					});
				}

				// Read the file content
				const content = await app.vault.read(file);

				// Build the old task line to search for
				const oldTaskLine = `\t- [${oldStatus}] ${oldText}`;

				// Check if the old task exists
				if (!content.includes(oldTaskLine)) {
					return response.status(404).json({
						error: 'Task not found',
						message: 'The specified task could not be found (it may have been modified)'
					});
				}

				// Build the new task line
				const newTaskLine = `\t- [${newStatus}] ${newText}`;

				// Replace the old task with the new one
				const newContent = content.replace(oldTaskLine, newTaskLine);

				// Save the file
				await app.vault.modify(file, newContent);

				// Return success response
				return response.status(200).json({
					message: 'Todo updated successfully',
					path: path,
					oldText: oldText,
					newText: newText
				});

			} catch (error) {
				console.error('Error updating todo:', error);
				return response.status(500).json({
					error: 'Internal server error',
					message: error.message
				});
			}
		});

		console.log('Todos REST API routes registered at /todos/');
	}

	/**
	 * Flatten the Grouping structure returned by Dataview into a simple array of tasks.
	 * The Grouping structure can be nested and contains both individual tasks and groups.
	 */
	private flattenTasks(grouping: any): any[] {
		const tasks: any[] = [];

		if (Array.isArray(grouping)) {
			for (const item of grouping) {
				if (item.rows) {
					// This is a group, recursively flatten
					tasks.push(...this.flattenTasks(item.rows));
				} else if (item.task) {
					// This is a task item
					tasks.push(item);
					// Also include any children/subtasks
					if (item.children && item.children.length > 0) {
						tasks.push(...this.flattenTasks(item.children));
					}
				}
			}
		}

		return tasks;
	}

	/**
	 * Process due dates using the logic from processDueDates.js
	 * Implements course filtering, date range filtering, and markdown table parsing
	 */
	private async processDueDates(app: ObsidianApp, dataviewApi: any, params: {
		courseId?: string;
		start?: string;
		end?: string;
		query?: string;
	}): Promise<any[]> {
		const { courseId, start, end, query } = params;
		const entries: any[] = [];

		// Determine the start and end dates using your processDueDates.js logic
		const startDate = start || new Date().toISOString().split('T')[0];
		const endDate = end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

		// Use dv.pages() like the original processDueDates.js
		// Original code: const pages = dv.pages(`${courseId}`).filter((p) => p.file.name !== courseId && p.file.ext == "md")
		let pages;
		if (courseId) {
			pages = dataviewApi.pages(courseId);
		} else {
			pages = dataviewApi.pages();
		}
		
		// Filter like original code: exclude the courseId file itself and non-markdown files
		const filteredPages = pages.filter((p) => p.file.name !== courseId && p.file.ext == "md");
		console.log('Filtered pages count:', filteredPages.length);

		// Process each page that matches the course filter
		for (const page of filteredPages) {
			if (!page['file.path']) continue;

			try {
				// Read the file content to parse the markdown table
				const file = app.vault.getAbstractFileByPath(page['file.path']);
				if (!(file instanceof TFile)) continue;

				const content = await app.vault.read(file);
				
				// Parse the # Due Dates section using your regex pattern
				const regex = /# Due Dates([\s\S]*?)(?=\n#|$)/;
				const matches = content.match(regex);
				
				if (!matches) continue;

				const tableData = matches[1].trim();
				const lines = tableData.split('\n').slice(1); // Skip header row

				for (const line of lines) {
					const columns = line
						.split('|')
						.map(c => c.trim())
						.filter(c => c);

					if (columns.length < 2) continue;

					let [dueDate, assignment] = columns;
					
					// Skip invalid dates and completed items (✅)
					if (!Date.parse(dueDate) || assignment?.includes('✅')) {
						continue;
					}

					// Apply date filtering
					const dueDateObj = new Date(dueDate);
					const startObj = new Date(startDate);
					const endObj = new Date(endDate);

					if (dueDateObj < startObj || dueDateObj > endObj) {
						continue;
					}

					// Apply query filtering
					if (query && !assignment.toLowerCase().includes(query.toLowerCase())) {
						continue;
					}

					// Format assignment with course prefix (from your logic)
					const formattedAssignment = assignment.match(/[A-Z]{3}-[0-9]{3}/)
						? assignment
						: `#${page['file.course_id'] || courseId || 'unknown'} - ${assignment}`;

					// Format due date based on your logic
					const now = new Date();
					const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
					const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

					let formattedDueDate = dueDate;
					if (dueDateObj > oneWeekAgo) {
						formattedDueDate = `<span class="due one_week">${dueDate}</span>`;
					} else if (dueDateObj > twoWeeksAgo) {
						formattedDueDate = `<span class="due two_weeks">${dueDate}</span>`;
					}

					// Add the entry
					entries.push({
						dueDate,
						formattedDueDate,
						assignment: formattedAssignment,
						filePath: page['file.path']
					});
				}

			} catch (error) {
				console.error(`Error processing file ${page['file.path']}:`, error);
			}
		}

		// Sort by due date
		entries.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

		return entries;
	}

	/**
	 * Get the current daily note path
	 * @returns The path to the current daily note
	 */
	private getCurrentDailyNotePath(): string {
		const today = new Date().toISOString().split('T')[0];
		return `${this.settings.dailyNotesPath}/${today}.md`;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		if (this.api) {
			this.api.unregister();
		}
		console.log('Unloading Todos REST API plugin');
	}
}

class TodosApiSettingTab extends PluginSettingTab {
	plugin: TodosApiPlugin;

	constructor(app: App, plugin: TodosApiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Todos API Settings'});

		new Setting(containerEl)
			.setName('Default section')
			.setDesc('The section header where new todos will be added')
			.addText(text => text
				.setPlaceholder('# Observations')
				.setValue(this.plugin.settings.defaultSection)
				.onChange(async (value) => {
					this.plugin.settings.defaultSection = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Daily notes path')
			.setDesc('The folder path where daily notes are stored')
			.addText(text => text
				.setPlaceholder('Daily Notes')
				.setValue(this.plugin.settings.dailyNotesPath)
				.onChange(async (value) => {
					this.plugin.settings.dailyNotesPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Excluded directories')
			.setDesc('Comma-separated list of directories to exclude from todos list')
			.addText(text => text
				.setPlaceholder('Timeless,Archive')
				.setValue(this.plugin.settings.excludedDirectories)
				.onChange(async (value) => {
					this.plugin.settings.excludedDirectories = value;
					await this.plugin.saveSettings();
				}));
	}
}
