CREATE TABLE `ads_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`platform` text NOT NULL,
	`campaign_name` text NOT NULL,
	`campaign_id` text,
	`date` integer NOT NULL,
	`spend` real DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`conversions` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_members` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`social_profile_id` text NOT NULL,
	`caption` text,
	`media_urls` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`social_profile_id`) REFERENCES `social_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`social_profile_id` text NOT NULL,
	`date` integer NOT NULL,
	`followers_count` integer DEFAULT 0 NOT NULL,
	`reach_count` integer DEFAULT 0 NOT NULL,
	`engagement_count` integer DEFAULT 0 NOT NULL,
	`posts_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`social_profile_id`) REFERENCES `social_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`platform` text NOT NULL,
	`profile_name` text NOT NULL,
	`profile_id` text,
	`chrome_profile_path` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`global_role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);