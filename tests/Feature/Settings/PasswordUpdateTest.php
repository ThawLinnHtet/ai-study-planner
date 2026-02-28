<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('password update page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('user-password.edit'));

    $response->assertOk();
});

test('password can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('user-password.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'Password123!',
            'password' => 'New-Password123!',
            'password_confirmation' => 'New-Password123!',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('user-password.edit'));

    expect(Hash::check('New-Password123!', $user->refresh()->password))->toBeTrue();
});

test('correct password must be provided to update password', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('user-password.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'New-Password123!',
            'password_confirmation' => 'New-Password123!',
        ]);

    $response
        ->assertSessionHasErrors('current_password')
        ->assertRedirect(route('user-password.edit'));
});
