CREATE TABLE `anonymous_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`usageDate` date NOT NULL,
	`conversionCount` int NOT NULL DEFAULT 1,
	CONSTRAINT `anonymous_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`anonymousId` varchar(64),
	`ipAddress` varchar(45),
	`originalFilename` varchar(255) NOT NULL,
	`fileSizeBytes` int NOT NULL,
	`fileHash` varchar(64),
	`pageCount` int,
	`status` enum('pending','processing','review','completed','failed') NOT NULL DEFAULT 'pending',
	`extractedTables` json,
	`tableCount` int,
	`rowCount` int,
	`processingTimeMs` int,
	`aiConfidenceScore` decimal(3,2),
	`aiWarnings` json,
	`detectedIssues` json,
	`errorCode` varchar(64),
	`errorMessage` text,
	`errorDetails` json,
	`pdfStoragePath` text,
	`xlsxStoragePath` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp,
	CONSTRAINT `conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`category` enum('finance','inventory','hr','general'),
	`columnDefinitions` json NOT NULL,
	`sampleData` json,
	`formatting` json,
	`icon` varchar(64),
	`color` varchar(20),
	`isPremium` boolean DEFAULT false,
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `templates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripePriceId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` enum('free','pro','canceled','past_due') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `currentPeriodEnd` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `conversionsToday` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `conversionsThisMonth` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalConversions` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastConversionAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `lastUsageResetDate` date;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredTemplate` varchar(64) DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `users` ADD `theme` enum('light','dark','system') DEFAULT 'system';--> statement-breakpoint
ALTER TABLE `conversions` ADD CONSTRAINT `conversions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;