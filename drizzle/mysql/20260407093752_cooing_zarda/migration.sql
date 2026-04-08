CREATE TABLE IF NOT EXISTS `permissions` (
	`id` int AUTO_INCREMENT PRIMARY KEY,
	`name` varchar(255) NOT NULL,
	`path` varchar(100) NOT NULL,
	`method` varchar(16) NOT NULL,
	`is_public` boolean NOT NULL DEFAULT false,
	`summary` text,
	`tags` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissions_path_unique` UNIQUE INDEX(`path`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT PRIMARY KEY,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`age` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`password` varchar(255) NOT NULL,
	CONSTRAINT `users_email_unique` UNIQUE INDEX(`email`)
);
