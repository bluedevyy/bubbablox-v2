<script lang="ts">
	// ty bootstrap for actually having native darkmode 💖💖💖
	import { onMount } from 'svelte';
	export let title: string;
	let dark = false;

	onMount(() => {
		if (typeof localStorage !== 'undefined' && localStorage.getItem('dark') === 'true') {
			dark = true;
			document.documentElement.setAttribute('data-bs-theme', 'dark');
		}

		document.getElementById('toggle-navbar').onclick = function (ev) {
			ev.preventDefault();
			let toToggle = document.getElementById('sidebarMenu');
			if (toToggle.getAttribute('style')) {
				toToggle.removeAttribute('style');
			} else {
				toToggle.setAttribute('style', 'display: block!important');
			}
		};
	});

	function toggledark() {
		dark = !dark;
		if (dark) {
			document.documentElement.setAttribute('data-bs-theme', 'dark');
			localStorage.setItem('dark', 'true');
		} else {
			document.documentElement.removeAttribute('data-bs-theme');
			localStorage.setItem('dark', 'false');
		}
	}
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>{title || 'Admin'}</title>
</svelte:head>

<header class="navbar navbar-dark sticky-top bg-dark flex-md-nowrap p-0 shadow">
	<div class="d-flex justify-content-between w-100">
		<div class="d-flex align-items-center">
			<a class="navbar-brand px-3" href="/admin">
				Management
			</a>
		</div>
		
		<div class="d-flex align-items-center">
			<button 
				class="btn btn-sm btn-outline-secondary mx-2" 
				on:click={toggledark} 
				title="Toggle Dark Theme"
			>
				{#if dark}
					☀️
				{:else}
					🌙
				{/if}
			</button>
			
			<button
				class="navbar-toggler d-md-none collapsed"
				type="button"
				id="toggle-navbar"
			>
				<span class="navbar-toggler-icon" />
			</button>
			
			<ul class="navbar-nav px-3">
				<li class="nav-item text-nowrap d-none d-md-block">
					<a class="nav-link" href="/home">Back to Site</a>
				</li>
			</ul>
		</div>
	</div>
</header>